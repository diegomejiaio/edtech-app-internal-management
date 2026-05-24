using System.Globalization;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Schedule"/> documents in the <c>master</c> container.
/// Per <c>docs/01-domain-model.md</c> §3.4 and <c>docs/04-api-design.md</c> §5.4.
/// </summary>
public sealed class ScheduleRepository : CosmosRepository<Schedule>
{
    protected override string ContainerName => ContainerNames.Master;
    protected override string TypeDiscriminator => EntityTypes.Schedule;

    public ScheduleRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<ScheduleRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>
    /// Lists schedules with optional <paramref name="status"/>, <paramref name="teacherId"/>,
    /// <paramref name="course"/>, and start-date range filters, plus pagination.
    /// Per <c>docs/04-api-design.md</c> §5.4.
    /// </summary>
    public async Task<(IReadOnlyList<Schedule> Items, int Total)> SearchAsync(
        ScheduleStatus? status,
        string? teacherId,
        string? course,
        DateOnly? startDateFrom,
        DateOnly? startDateTo,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        if (status is not null) where += " AND c.status = @status";
        if (!string.IsNullOrWhiteSpace(teacherId)) where += " AND c.teacherId = @teacherId";
        if (!string.IsNullOrWhiteSpace(course)) where += " AND c.course = @course";
        if (startDateFrom is not null) where += " AND c.startDate >= @startDateFrom";
        if (startDateTo is not null) where += " AND c.startDate <= @startDateTo";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}");
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.updatedAt DESC, c.createdAt DESC OFFSET @offset LIMIT @limit");

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
        if (!string.IsNullOrWhiteSpace(teacherId))
        {
            countDef.WithParameter("@teacherId", teacherId);
            pageDef.WithParameter("@teacherId", teacherId);
        }
        if (!string.IsNullOrWhiteSpace(course))
        {
            countDef.WithParameter("@course", course);
            pageDef.WithParameter("@course", course);
        }
        if (startDateFrom is not null)
        {
            var from = startDateFrom.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            countDef.WithParameter("@startDateFrom", from);
            pageDef.WithParameter("@startDateFrom", from);
        }
        if (startDateTo is not null)
        {
            var to = startDateTo.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            countDef.WithParameter("@startDateTo", to);
            pageDef.WithParameter("@startDateTo", to);
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

        var items = new List<Schedule>(limit);
        using var iter = Container.GetItemQueryIterator<Schedule>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total);
    }

    /// <summary>
    /// Returns the count of <see cref="Schedule"/> documents assigned to a teacher whose
    /// <c>status</c> is <c>active</c> or <c>inProgress</c>. Used by Teacher delete (§5.3) to
    /// return 409 when the teacher is still tied to running classes.
    /// </summary>
    public async Task<int> CountActiveByTeacherAsync(string teacherId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(@"
            SELECT VALUE COUNT(1) FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.teacherId = @teacherId
               AND c.status IN (@active, @inProgress)")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@teacherId", teacherId)
            .WithParameter("@active", EnumWire.ToCamel(ScheduleStatus.Active))
            .WithParameter("@inProgress", EnumWire.ToCamel(ScheduleStatus.InProgress));

        using var iter = Container.GetItemQueryIterator<int>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        var total = 0;
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            total += page.Sum();
        }
        return total;
    }
}
