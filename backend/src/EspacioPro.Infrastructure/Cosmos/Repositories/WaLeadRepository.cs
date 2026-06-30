using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="WaLead"/> documents in the <c>whatsapp</c> container.
/// Per <c>docs/10-whatsapp-crm-mvp.md</c> §1.
/// </summary>
public sealed class WaLeadRepository : CosmosRepository<WaLead>
{
    protected override string ContainerName => ContainerNames.WhatsApp;
    protected override string TypeDiscriminator => EntityTypes.Lead;

    private readonly CosmosClient _cosmosClient;
    private readonly string _databaseName;

    public WaLeadRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<WaLeadRepository> logger)
        : base(cosmosClient, options, currentUser, logger)
    {
        _cosmosClient = cosmosClient;
        _databaseName = options.Value.Database;
    }

    /// <summary>Ensures the <c>whatsapp</c> container exists before first use (dev convenience).</summary>
    public Task EnsureContainerAsync(CancellationToken ct = default) =>
        WhatsAppContainerBootstrap.EnsureAsync(_cosmosClient, _databaseName, ct);

    /// <summary>Finds an active lead by phone, or null.</summary>
    public async Task<WaLead?> GetByPhoneAsync(string phone, CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);

        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = @type AND c.active = true AND c.phone = @phone")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@phone", phone);

        using var iterator = Container.GetItemQueryIterator<WaLead>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var item = (await iterator.ReadNextAsync(ct)).FirstOrDefault();
            if (item is not null) return item;
        }
        return null;
    }
}
