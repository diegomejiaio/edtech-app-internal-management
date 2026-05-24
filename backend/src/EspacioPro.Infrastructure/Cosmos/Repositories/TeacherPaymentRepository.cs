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

    /// <summary>
    /// Lists payments with optional <paramref name="teacherId"/> and date-range filters,
    /// plus pagination. Per <c>docs/04-api-design.md</c> §5.7.
    /// </summary>
    public async Task<(IReadOnlyList<TeacherPayment> Items, int Total)> SearchAsync(
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
            $"SELECT * FROM c WHERE {where} ORDER BY c.updatedAt DESC, c.createdAt DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", limit);

        if (!string.IsNullOrWhiteSpace(teacherId))
        {
            countDef.WithParameter("@teacherId", teacherId);
            pageDef.WithParameter("@teacherId", teacherId);
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

        var items = new List<TeacherPayment>(limit);
        using var iter = Container.GetItemQueryIterator<TeacherPayment>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total);
    }
}
