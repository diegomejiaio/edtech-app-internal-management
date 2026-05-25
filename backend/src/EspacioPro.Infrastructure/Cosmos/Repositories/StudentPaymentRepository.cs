using System.Text.Json.Serialization;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="StudentPayment"/> documents in the <c>operations</c> container.
/// Per <c>docs/01-domain-model.md</c> §3.6 and <c>docs/04-api-design.md</c> §5.6 + §6.2.
/// </summary>
/// <remarks>
/// Owns the debtors query (<see cref="ListDebtorsAsync"/>) used by the operational endpoint
/// <c>GET /api/v1/student-payments/debtors?scheduleId=X&amp;month=YYYY-MM</c>.
/// </remarks>
public sealed class StudentPaymentRepository : CosmosRepository<StudentPayment>
{
    protected override string ContainerName => ContainerNames.Operations;
    protected override string TypeDiscriminator => EntityTypes.StudentPayment;

    public StudentPaymentRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<StudentPaymentRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>
    /// Lists payments with optional <paramref name="enrollmentId"/>, <paramref name="studentId"/>,
    /// and date-range filters, plus pagination. Per <c>docs/04-api-design.md</c> §5.6.
    /// </summary>
    public async Task<(IReadOnlyList<StudentPayment> Items, int Total)> SearchAsync(
        string? enrollmentId,
        string? studentId,
        DateOnly? from,
        DateOnly? to,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        if (!string.IsNullOrWhiteSpace(enrollmentId)) where += " AND c.enrollmentId = @enrollmentId";
        if (!string.IsNullOrWhiteSpace(studentId)) where += " AND c.studentId = @studentId";
        if (from is not null) where += " AND c.date >= @from";
        if (to is not null) where += " AND c.date <= @to";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}")
            .WithParameter("@type", TypeDiscriminator);
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.date DESC OFFSET @offset LIMIT @limit")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@offset", offset)
            .WithParameter("@limit", limit);

        if (!string.IsNullOrWhiteSpace(enrollmentId))
        {
            countDef.WithParameter("@enrollmentId", enrollmentId);
            pageDef.WithParameter("@enrollmentId", enrollmentId);
        }
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            countDef.WithParameter("@studentId", studentId);
            pageDef.WithParameter("@studentId", studentId);
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

        var items = new List<StudentPayment>(limit);
        using var iter = Container.GetItemQueryIterator<StudentPayment>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            items.AddRange(page);
        }

        return (items, total);
    }

    /// <summary>
    /// Returns, for the given <paramref name="enrollmentIds"/> and inclusive date range,
    /// the most recent active payment date per enrollment. Used by the dashboard and debtors
    /// query (api-design §6.1 / §6.2). Enrollments with no payment in the window are absent
    /// from the result and treated as debtors by the caller.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, DateOnly>> GetLastPaymentDatesAsync(
        IReadOnlyCollection<string> enrollmentIds,
        DateOnly from,
        DateOnly to,
        CancellationToken ct = default)
    {
        if (enrollmentIds.Count == 0)
            return new Dictionary<string, DateOnly>(0);

        // ARRAY_CONTAINS keeps the parameter list constant regardless of input size.
        var query = new QueryDefinition(@"
            SELECT c.enrollmentId AS enrollmentId, MAX(c.date) AS lastDate
              FROM c
             WHERE c.type = @type
               AND c.active = true
               AND ARRAY_CONTAINS(@enrollmentIds, c.enrollmentId)
               AND c.date >= @from
               AND c.date <= @to
             GROUP BY c.enrollmentId")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@enrollmentIds", enrollmentIds.ToArray())
            .WithParameter("@from", from.ToString("yyyy-MM-dd"))
            .WithParameter("@to", to.ToString("yyyy-MM-dd"));

        var result = new Dictionary<string, DateOnly>(enrollmentIds.Count);
        using var iter = Container.GetItemQueryIterator<DebtorRow>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            foreach (var row in page)
            {
                if (DateOnly.TryParse(row.LastDate, out var d))
                    result[row.EnrollmentId] = d;
            }
        }

        return result;
    }

    /// <summary>
    /// Returns the total active student payments per enrollment across all dates.
    /// Used by read models that show enrollment-level balances.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, decimal>> GetTotalPaidAmountsAsync(
        IReadOnlyCollection<string> enrollmentIds,
        CancellationToken ct = default)
    {
        if (enrollmentIds.Count == 0)
            return new Dictionary<string, decimal>(0);

        var query = new QueryDefinition(@"
            SELECT c.enrollmentId AS enrollmentId, SUM(c.amount) AS totalAmount
              FROM c
             WHERE c.type = @type
               AND c.active = true
               AND ARRAY_CONTAINS(@enrollmentIds, c.enrollmentId)
             GROUP BY c.enrollmentId")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@enrollmentIds", enrollmentIds.ToArray());

        var result = new Dictionary<string, decimal>(enrollmentIds.Count);
        using var iter = Container.GetItemQueryIterator<PaymentTotalRow>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            foreach (var row in page)
            {
                result[row.EnrollmentId] = row.TotalAmount;
            }
        }

        return result;
    }

    private sealed record DebtorRow(string EnrollmentId, string LastDate);

    private sealed record PaymentTotalRow(
        [property: JsonPropertyName("enrollmentId")] string EnrollmentId,
        [property: JsonPropertyName("totalAmount")] decimal TotalAmount);
}
