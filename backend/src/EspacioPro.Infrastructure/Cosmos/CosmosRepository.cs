using System.Net;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Abstractions;
using EspacioPro.Domain.Common;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos;

/// <summary>
/// Generic Cosmos DB repository. Concrete repositories inherit and specify
/// <see cref="ContainerName"/> and <see cref="TypeDiscriminator"/>.
/// Audit fields are auto-populated from <see cref="ICurrentUser"/>.
/// </summary>
public abstract class CosmosRepository<T> : IRepository<T> where T : BaseEntity
{
    private readonly Container _container;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger _logger;

    /// <summary>Cosmos container name (e.g. "master" or "operations").</summary>
    protected abstract string ContainerName { get; }

    /// <summary>Value of the <c>type</c> discriminator for this entity (e.g. "student").</summary>
    protected abstract string TypeDiscriminator { get; }

    protected CosmosRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger logger)
    {
        var database = cosmosClient.GetDatabase(options.Value.Database);
        _container = database.GetContainer(ContainerName);
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>Provides direct container access for derived repos with custom queries.</summary>
    protected Container Container => _container;

    /// <summary>
    /// Hook invoked at the top of <see cref="CreateAsync"/> and <see cref="UpdateAsync"/>
    /// after audit fields are set but before the document is sent to Cosmos.
    /// Derived repositories override this to populate computed projections
    /// (for example, accent-folded <c>searchText</c>). Default impl is a no-op.
    /// </summary>
    protected virtual void OnBeforeWrite(T entity) { }

    public async Task<T?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<T>(
                id,
                new PartitionKey(TypeDiscriminator),
                cancellationToken: ct);

            var entity = response.Resource;
            entity.ETag = response.ETag;

            if (!entity.Active)
                return null;

            return entity;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<T>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        // Default ordering across all listings: most-recently-updated first,
        // tie-break by createdAt DESC. Both fields are populated by BaseEntity
        // initializers, so the composite ORDER BY is always defined. Requires
        // a composite index (updatedAt DESC, createdAt DESC) on the container.
        var query = includeInactive
            ? "SELECT * FROM c WHERE c.type = @type ORDER BY c.updatedAt DESC, c.createdAt DESC"
            : "SELECT * FROM c WHERE c.type = @type AND c.active = true ORDER BY c.updatedAt DESC, c.createdAt DESC";

        var queryDef = new QueryDefinition(query)
            .WithParameter("@type", TypeDiscriminator);

        var results = new List<T>();
        using var iterator = _container.GetItemQueryIterator<T>(
            queryDef,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            results.AddRange(page);
        }

        return results;
    }

    public async Task<T> CreateAsync(T entity, CancellationToken ct = default)
    {
        var auditUser = RequireAuditUser();
        var now = DateTime.UtcNow.ToString("o");

        entity.Id = Guid.NewGuid().ToString("D");
        entity.Active = true;
        entity.CreatedAt = now;
        entity.CreatedBy = auditUser;
        entity.UpdatedAt = now;
        entity.UpdatedBy = auditUser;
        entity.DeletedAt = null;
        entity.DeletedBy = null;

        OnBeforeWrite(entity);

        var response = await _container.CreateItemAsync(
            entity,
            new PartitionKey(TypeDiscriminator),
            cancellationToken: ct);

        var created = response.Resource;
        created.ETag = response.ETag;

        _logger.LogInformation("Created {Type} {Id} by {User}",
            TypeDiscriminator, created.Id, auditUser.Email);

        return created;
    }

    public async Task<T> UpdateAsync(T entity, CancellationToken ct = default)
    {
        var auditUser = RequireAuditUser();

        entity.UpdatedAt = DateTime.UtcNow.ToString("o");
        entity.UpdatedBy = auditUser;

        OnBeforeWrite(entity);

        var requestOptions = new ItemRequestOptions();
        if (!string.IsNullOrEmpty(entity.ETag))
            requestOptions.IfMatchEtag = entity.ETag;

        var response = await _container.ReplaceItemAsync(
            entity,
            entity.Id,
            new PartitionKey(TypeDiscriminator),
            requestOptions,
            ct);

        var updated = response.Resource;
        updated.ETag = response.ETag;

        _logger.LogInformation("Updated {Type} {Id} by {User}",
            TypeDiscriminator, updated.Id, auditUser.Email);

        return updated;
    }

    /// <summary>
    /// Re-applies <see cref="OnBeforeWrite"/> to every document of this type
    /// (including inactive) and replaces them in Cosmos. Used for backfilling
    /// computed projections (for example, <c>searchText</c>) after the
    /// projection logic changes. Audit fields are preserved — this is a
    /// system-level reindex, not a user-driven update.
    /// </summary>
    /// <returns>Number of documents reindexed.</returns>
    public async Task<int> ReindexAllAsync(CancellationToken ct = default)
    {
        var queryDef = new QueryDefinition("SELECT * FROM c WHERE c.type = @type")
            .WithParameter("@type", TypeDiscriminator);

        var count = 0;
        using var iterator = _container.GetItemQueryIterator<T>(
            queryDef,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            foreach (var entity in page)
            {
                OnBeforeWrite(entity);
                await _container.ReplaceItemAsync(
                    entity,
                    entity.Id,
                    new PartitionKey(TypeDiscriminator),
                    cancellationToken: ct);
                count++;
            }
        }

        _logger.LogInformation("Reindexed {Count} {Type} document(s)", count, TypeDiscriminator);
        return count;
    }

    public async Task SoftDeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Entity {TypeDiscriminator}/{id} not found.");

        var auditUser = RequireAuditUser();
        var now = DateTime.UtcNow.ToString("o");

        entity.Active = false;
        entity.DeletedAt = now;
        entity.DeletedBy = auditUser;
        entity.UpdatedAt = now;
        entity.UpdatedBy = auditUser;

        var requestOptions = new ItemRequestOptions();
        if (!string.IsNullOrEmpty(entity.ETag))
            requestOptions.IfMatchEtag = entity.ETag;

        await _container.ReplaceItemAsync(
            entity,
            entity.Id,
            new PartitionKey(TypeDiscriminator),
            requestOptions,
            ct);

        _logger.LogInformation("Soft-deleted {Type} {Id} by {User}",
            TypeDiscriminator, id, auditUser.Email);
    }

    private AuditUser RequireAuditUser() =>
        _currentUser.GetAuditUser()
        ?? throw new InvalidOperationException(
            "Authenticated user required for write operations. Ensure JWT middleware is active.");
}
