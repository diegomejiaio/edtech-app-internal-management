using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Teacher"/> documents in the <c>master</c> container.
/// Adds dedup lookup (<see cref="GetByDocAsync"/>) and search (<see cref="SearchAsync"/>).
/// </summary>
public sealed class TeacherRepository : CosmosRepository<Teacher>
{
    protected override string ContainerName => ContainerNames.Master;
    protected override string TypeDiscriminator => EntityTypes.Teacher;

    public TeacherRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<TeacherRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <inheritdoc />
    protected override void OnBeforeWrite(Teacher entity) =>
        entity.SearchText = TextNormalizer.Compose(
            entity.FirstName,
            entity.LastName,
            entity.DocNumber,
            entity.Phone,
            TextNormalizer.DigitsOnly(entity.Phone));

    /// <summary>
    /// Finds an active teacher by <c>docType + docNumber</c>. Used for dedup on POST.
    /// </summary>
    public async Task<Teacher?> GetByDocAsync(DocType docType, string docNumber, CancellationToken ct = default)
    {
        var docTypeWire = EnumWire.ToCamel(docType);

        var query = new QueryDefinition(@"
            SELECT * FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.docType = @docType
               AND c.docNumber = @docNumber")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@docType", docTypeWire)
            .WithParameter("@docNumber", docNumber);

        using var iterator = Container.GetItemQueryIterator<Teacher>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            var teacher = page.FirstOrDefault();
            if (teacher is not null)
                return teacher;
        }

        return null;
    }

    /// <summary>
    /// Lists teachers with optional substring search on first/last name or doc number,
    /// optional <paramref name="specialty"/> filter, and pagination.
    /// Per <c>docs/04-api-design.md</c> §5.3.
    /// </summary>
    public async Task<(IReadOnlyList<Teacher> Items, int Total)> SearchAsync(
        string? search,
        string? specialty,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        var hasSearch = !string.IsNullOrWhiteSpace(search);
        var hasSpecialty = !string.IsNullOrWhiteSpace(specialty);

        if (hasSearch)
            where += " AND CONTAINS(c.searchText, @search)";
        if (hasSpecialty)
            where += " AND c.specialty = @specialty";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}");
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.updatedAt DESC, c.createdAt DESC OFFSET @offset LIMIT @limit");

        countDef.WithParameter("@type", TypeDiscriminator);
        pageDef.WithParameter("@type", TypeDiscriminator)
               .WithParameter("@offset", offset)
               .WithParameter("@limit", limit);

        if (hasSearch)
        {
            var normalized = TextNormalizer.Normalize(search);
            countDef.WithParameter("@search", normalized);
            pageDef.WithParameter("@search", normalized);
        }
        if (hasSpecialty)
        {
            countDef.WithParameter("@specialty", specialty);
            pageDef.WithParameter("@specialty", specialty);
        }

        var partitionOpts = new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) };

        var total = 0;
        using (var countIter = Container.GetItemQueryIterator<int>(countDef, requestOptions: partitionOpts))
        {
            while (countIter.HasMoreResults)
            {
                var page = await countIter.ReadNextAsync(ct);
                total += page.Sum();
            }
        }

        var items = new List<Teacher>(limit);
        using var iter = Container.GetItemQueryIterator<Teacher>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total);
    }
}
