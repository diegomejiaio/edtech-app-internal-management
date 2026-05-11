using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Enrollment"/> documents in the <c>operations</c> container.
/// Per <c>docs/01-domain-model.md</c> §3.5 and <c>docs/04-api-design.md</c> §5.5.
/// </summary>
/// <remarks>
/// First repository targeting the <c>operations</c> container. Cross-aggregate counts
/// (used by Student/Teacher/Schedule delete checks) live here to keep dependency direction:
/// master-aggregates depend on operations, never the other way.
/// </remarks>
public sealed class EnrollmentRepository : CosmosRepository<Enrollment>
{
    protected override string ContainerName => ContainerNames.Operations;
    protected override string TypeDiscriminator => EntityTypes.Enrollment;

    public EnrollmentRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<EnrollmentRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>
    /// Lists enrollments with optional <paramref name="studentId"/>, <paramref name="scheduleId"/>,
    /// and <paramref name="status"/> filters, plus pagination. Per <c>docs/04-api-design.md</c> §5.5.
    /// </summary>
    public async Task<(IReadOnlyList<Enrollment> Items, int Total)> SearchAsync(
        string? studentId,
        string? scheduleId,
        EnrollmentStatus? status,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        if (!string.IsNullOrWhiteSpace(studentId)) where += " AND c.studentId = @studentId";
        if (!string.IsNullOrWhiteSpace(scheduleId)) where += " AND c.scheduleId = @scheduleId";
        if (status is not null) where += " AND c.status = @status";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}");
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.enrollmentDate DESC OFFSET @offset LIMIT @limit");

        countDef.WithParameter("@type", TypeDiscriminator);
        pageDef.WithParameter("@type", TypeDiscriminator)
               .WithParameter("@offset", offset)
               .WithParameter("@limit", limit);

        if (!string.IsNullOrWhiteSpace(studentId))
        {
            countDef.WithParameter("@studentId", studentId);
            pageDef.WithParameter("@studentId", studentId);
        }
        if (!string.IsNullOrWhiteSpace(scheduleId))
        {
            countDef.WithParameter("@scheduleId", scheduleId);
            pageDef.WithParameter("@scheduleId", scheduleId);
        }
        if (status is not null)
        {
            var wire = EnumWire.ToCamel(status.Value);
            countDef.WithParameter("@status", wire);
            pageDef.WithParameter("@status", wire);
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

        var items = new List<Enrollment>(limit);
        using var iter = Container.GetItemQueryIterator<Enrollment>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            foreach (var e in page)
            {
                e.ETag = page.ETag;
                items.Add(e);
            }
        }

        return (items, total);
    }

    /// <summary>
    /// Returns true when an active enrollment for the same (student, schedule) tuple already exists.
    /// Used by POST /enrollments to enforce §3.5 uniqueness ("studentId + scheduleId AND status='active' AND active=true").
    /// </summary>
    public async Task<bool> ExistsActiveAsync(string studentId, string scheduleId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(@"
            SELECT VALUE COUNT(1) FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.status = @active
               AND c.studentId = @studentId
               AND c.scheduleId = @scheduleId")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@active", EnumWire.ToCamel(EnrollmentStatus.Active))
            .WithParameter("@studentId", studentId)
            .WithParameter("@scheduleId", scheduleId);

        return await CountSingleAsync(query, ct) > 0;
    }

    /// <summary>
    /// Counts active enrollments for a given <paramref name="scheduleId"/>. Used by
    /// Schedule.GET (occupancyPct) and Schedule.DELETE (409 if &gt; 0).
    /// </summary>
    public Task<int> CountActiveByScheduleAsync(string scheduleId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(@"
            SELECT VALUE COUNT(1) FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.status = @active
               AND c.scheduleId = @scheduleId")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@active", EnumWire.ToCamel(EnrollmentStatus.Active))
            .WithParameter("@scheduleId", scheduleId);

        return CountSingleAsync(query, ct);
    }

    /// <summary>
    /// Counts active enrollments for a given <paramref name="studentId"/>. Used by
    /// Student.DELETE (409 if &gt; 0).
    /// </summary>
    public Task<int> CountActiveByStudentAsync(string studentId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(@"
            SELECT VALUE COUNT(1) FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.status = @active
               AND c.studentId = @studentId")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@active", EnumWire.ToCamel(EnrollmentStatus.Active))
            .WithParameter("@studentId", studentId);

        return CountSingleAsync(query, ct);
    }

    private async Task<int> CountSingleAsync(QueryDefinition query, CancellationToken ct)
    {
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
