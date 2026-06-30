using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="WaConversation"/> documents in the <c>whatsapp</c> container.
/// Paginated search by status / free text. Per <c>docs/10-whatsapp-crm-mvp.md</c> §2.
/// </summary>
public sealed class WaConversationRepository : CosmosRepository<WaConversation>
{
    protected override string ContainerName => ContainerNames.WhatsApp;
    protected override string TypeDiscriminator => EntityTypes.Conversation;

    private readonly CosmosClient _cosmosClient;
    private readonly string _databaseName;

    public WaConversationRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<WaConversationRepository> logger)
        : base(cosmosClient, options, currentUser, logger)
    {
        _cosmosClient = cosmosClient;
        _databaseName = options.Value.Database;
    }

    /// <inheritdoc />
    protected override void OnBeforeWrite(WaConversation entity) =>
        entity.SearchText = TextNormalizer.Compose(
            entity.DisplayName,
            entity.Phone,
            TextNormalizer.DigitsOnly(entity.Phone));

    /// <summary>Ensures the <c>whatsapp</c> container exists before first use (dev convenience).</summary>
    public Task EnsureContainerAsync(CancellationToken ct = default) =>
        WhatsAppContainerBootstrap.EnsureAsync(_cosmosClient, _databaseName, ct);

    /// <summary>
    /// Lists conversations with optional status filter and substring search on
    /// displayName / phone, ordered by most recent activity.
    /// </summary>
    public async Task<(IReadOnlyList<WaConversation> Items, int Total)> SearchAsync(
        WaConversationStatus? status,
        string? search,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        await EnsureContainerAsync(ct);

        var where = "c.type = @type AND c.active = true";
        var hasSearch = !string.IsNullOrWhiteSpace(search);

        if (status is not null)
            where += " AND c.status = @status";
        if (hasSearch)
            where += " AND CONTAINS(c.searchText, @search)";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}");
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.lastMessageAt DESC, c.updatedAt DESC OFFSET @offset LIMIT @limit");

        countDef.WithParameter("@type", TypeDiscriminator);
        pageDef.WithParameter("@type", TypeDiscriminator)
               .WithParameter("@offset", offset)
               .WithParameter("@limit", limit);

        if (status is not null)
        {
            var statusWire = EnumWire.ToCamel(status.Value);
            countDef.WithParameter("@status", statusWire);
            pageDef.WithParameter("@status", statusWire);
        }
        if (hasSearch)
        {
            var normalized = TextNormalizer.Normalize(search);
            countDef.WithParameter("@search", normalized);
            pageDef.WithParameter("@search", normalized);
        }

        var partitionOpts = new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) };

        var total = 0;
        using (var countIter = Container.GetItemQueryIterator<int>(countDef, requestOptions: partitionOpts))
        {
            while (countIter.HasMoreResults)
                total += (await countIter.ReadNextAsync(ct)).Sum();
        }

        var items = new List<WaConversation>(limit);
        using var iter = Container.GetItemQueryIterator<WaConversation>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
            items.AddRange(await iter.ReadNextAsync(ct));

        return (items, total);
    }
}
