using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Catalog"/> documents in the <c>master</c> container.
/// Adds <see cref="GetByCodeAsync"/> for code-based lookups.
/// </summary>
public sealed class CatalogRepository : CosmosRepository<Catalog>
{
    protected override string ContainerName => ContainerNames.Master;
    protected override string TypeDiscriminator => EntityTypes.Catalog;

    public CatalogRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<CatalogRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>
    /// Finds a catalog by its unique <c>code</c> (e.g. "paymentMethods").
    /// </summary>
    public async Task<Catalog?> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = @type AND c.code = @code AND c.active = true")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@code", code);

        using var iterator = Container.GetItemQueryIterator<Catalog>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            var catalog = page.FirstOrDefault();
            if (catalog is not null)
                return catalog;
        }

        return null;
    }
}
