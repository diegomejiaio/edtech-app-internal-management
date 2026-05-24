using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Expense"/> documents in the <c>operations</c> container.
/// Per <c>docs/01-domain-model.md</c> §3.8 and <c>docs/04-api-design.md</c> §5.8.
/// </summary>
public sealed class ExpenseRepository : CosmosRepository<Expense>
{
    protected override string ContainerName => ContainerNames.Operations;
    protected override string TypeDiscriminator => EntityTypes.Expense;

    public ExpenseRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<ExpenseRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <inheritdoc />
    protected override void OnBeforeWrite(Expense entity) =>
        entity.SearchText = TextNormalizer.Compose(
            entity.Description,
            entity.Category,
            entity.ScheduleName);

    /// <summary>
    /// Lists expenses with optional free-text <paramref name="search"/> (accent-insensitive
    /// over <c>description + category + scheduleName</c>), date-range,
    /// <paramref name="category"/>, and <paramref name="scheduleId"/> filters, plus
    /// pagination. Per <c>docs/04-api-design.md</c> §5.8.
    /// </summary>
    public async Task<(IReadOnlyList<Expense> Items, int Total)> SearchAsync(
        string? search,
        DateOnly? from,
        DateOnly? to,
        string? category,
        string? scheduleId,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        if (!string.IsNullOrWhiteSpace(search)) where += " AND CONTAINS(c.searchText, @search)";
        if (from is not null) where += " AND c.date >= @from";
        if (to is not null) where += " AND c.date <= @to";
        if (!string.IsNullOrWhiteSpace(category)) where += " AND c.category = @category";
        if (!string.IsNullOrWhiteSpace(scheduleId)) where += " AND c.scheduleId = @scheduleId";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator);
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.date DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", limit);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = TextNormalizer.Normalize(search);
            countDef.WithParameter("@search", normalized);
            pageDef.WithParameter("@search", normalized);
        }
        if (from is not null)
        {
            var v = from.Value.ToString("yyyy-MM-dd");
            countDef.WithParameter("@from", v);
            pageDef.WithParameter("@from", v);
        }
        if (to is not null)
        {
            var v = to.Value.ToString("yyyy-MM-dd");
            countDef.WithParameter("@to", v);
            pageDef.WithParameter("@to", v);
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            countDef.WithParameter("@category", category);
            pageDef.WithParameter("@category", category);
        }
        if (!string.IsNullOrWhiteSpace(scheduleId))
        {
            countDef.WithParameter("@scheduleId", scheduleId);
            pageDef.WithParameter("@scheduleId", scheduleId);
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

        var items = new List<Expense>(limit);
        using var iter = Container.GetItemQueryIterator<Expense>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total);
    }
}
