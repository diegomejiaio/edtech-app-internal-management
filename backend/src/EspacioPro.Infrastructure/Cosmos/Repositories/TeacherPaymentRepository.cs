using System.Text.Json.Serialization;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="TeacherPayment"/> documents in the <c>operations</c> container.
/// Per <c>docs/01-domain-model.md</c> §3.7 and <c>docs/04-api-design.md</c> §5.7.
/// </summary>
public sealed class TeacherPaymentRepository : CosmosRepository<TeacherPayment>
{
    protected override string ContainerName => ContainerNames.Operations;
    protected override string TypeDiscriminator => EntityTypes.TeacherPayment;

    public TeacherPaymentRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<TeacherPaymentRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>Finds a <see cref="TeacherPayment"/> by its short business <c>code</c>.</summary>
    public async Task<TeacherPayment?> GetByCodeAsync(string code, bool includeInactive = false, CancellationToken ct = default)
    {
        var where = "c.type = @type AND c.code = @code" + (includeInactive ? "" : " AND c.active = true");
        var query = new QueryDefinition($"SELECT * FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@code", code);

        using var iterator = Container.GetItemQueryIterator<TeacherPayment>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            var item = page.FirstOrDefault();
            if (item is not null)
                return item;
        }

        return null;
    }

    /// <summary>
    /// Lists teacher payments with optional filters and pagination.
    /// Returns both row count and monetary aggregate for the full filtered result.
    /// </summary>
    public async Task<(IReadOnlyList<TeacherPayment> Items, int Total, decimal TotalAmount)> SearchAsync(
        string? teacherId,
        DateOnly? from,
        DateOnly? to,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        if (!string.IsNullOrWhiteSpace(teacherId)) where += " AND c.teacherId = @teacherId";
        if (from is not null) where += " AND c.date >= @from";
        if (to is not null) where += " AND c.date <= @to";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator);
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.date DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", limit);
        var totalAmountDef = new QueryDefinition(
            $"SELECT SUM(c.amount) AS totalAmount FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator);

        if (!string.IsNullOrWhiteSpace(teacherId))
        {
            countDef.WithParameter("@teacherId", teacherId);
            pageDef.WithParameter("@teacherId", teacherId);
            totalAmountDef.WithParameter("@teacherId", teacherId);
        }
        if (from is not null)
        {
            var v = from.Value.ToString("yyyy-MM-dd");
            countDef.WithParameter("@from", v);
            pageDef.WithParameter("@from", v);
            totalAmountDef.WithParameter("@from", v);
        }
        if (to is not null)
        {
            var v = to.Value.ToString("yyyy-MM-dd");
            countDef.WithParameter("@to", v);
            pageDef.WithParameter("@to", v);
            totalAmountDef.WithParameter("@to", v);
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

        decimal totalAmount = 0;
        using (var totalAmountIter = Container.GetItemQueryIterator<TotalAmountRow>(totalAmountDef, requestOptions: partitionOpts))
        {
            while (totalAmountIter.HasMoreResults)
            {
                var page = await totalAmountIter.ReadNextAsync(ct);
                totalAmount += page.Sum(row => row.TotalAmount ?? 0);
            }
        }

        var items = new List<TeacherPayment>(limit);
        using var iter = Container.GetItemQueryIterator<TeacherPayment>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total, totalAmount);
    }

    private sealed record TotalAmountRow(
        [property: JsonPropertyName("totalAmount")] decimal? TotalAmount);
}
