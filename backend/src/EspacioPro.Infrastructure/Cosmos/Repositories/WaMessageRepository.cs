using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="WaMessage"/> documents in the <c>whatsapp</c> container.
/// Messages are read as a paginated thread by conversation. Per <c>docs/10-whatsapp-crm-mvp.md</c> §2.
/// </summary>
public sealed class WaMessageRepository : CosmosRepository<WaMessage>
{
    protected override string ContainerName => ContainerNames.WhatsApp;
    protected override string TypeDiscriminator => EntityTypes.Message;

    private readonly CosmosClient _cosmosClient;
    private readonly string _databaseName;

    public WaMessageRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<WaMessageRepository> logger)
        : base(cosmosClient, options, currentUser, logger)
    {
        _cosmosClient = cosmosClient;
        _databaseName = options.Value.Database;
    }

    /// <summary>Ensures the <c>whatsapp</c> container exists before first use (dev convenience).</summary>
    public Task EnsureContainerAsync(CancellationToken ct = default) =>
        WhatsAppContainerBootstrap.EnsureAsync(_cosmosClient, _databaseName, ct);

    /// <summary>Lists messages for a conversation, oldest first, with pagination.</summary>
    /// <summary>
    /// Returns a page of messages for a conversation, **newest first** (<c>ts DESC</c>),
    /// so chat clients can load the latest N and page backwards via <paramref name="offset"/>.
    /// </summary>
    public async Task<(IReadOnlyList<WaMessage> Items, int Total)> ListByConversationAsync(
        string conversationId,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);

        const string where = "c.type = @type AND c.active = true AND c.conversationId = @conversationId";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@conversationId", conversationId);
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.ts DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@conversationId", conversationId)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", limit);

        var partitionOpts = new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) };

        var total = 0;
        using (var countIter = Container.GetItemQueryIterator<int>(countDef, requestOptions: partitionOpts))
        {
            while (countIter.HasMoreResults)
                total += (await countIter.ReadNextAsync(ct)).Sum();
        }

        var items = new List<WaMessage>(limit);
        using var iter = Container.GetItemQueryIterator<WaMessage>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
            items.AddRange(await iter.ReadNextAsync(ct));

        return (items, total);
    }
}
