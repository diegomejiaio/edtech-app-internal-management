using System.Text.Json.Serialization;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Common;

/// <summary>
/// Composite read-only view powering the M9 schedule dashboard
/// (<c>GET /api/v1/schedules/{id}/dashboard?month=YYYY-MM</c>).
/// Shape per <c>docs/04-api-design.md §6.1</c>.
/// </summary>
/// <remarks>
/// Aggregates a schedule, its active enrollments, and a per-enrollment paid/debtor
/// flag for the requested month. All data is derived at request time and never persisted.
/// </remarks>
public sealed record ScheduleDashboardResponse
{
    [JsonPropertyName("schedule")]
    public ScheduleResponse Schedule { get; init; } = default!;

    /// <summary>Year-month being reported, in <c>YYYY-MM</c> format.</summary>
    [JsonPropertyName("month")]
    public string Month { get; init; } = default!;

    [JsonPropertyName("enrollments")]
    public IReadOnlyList<ScheduleDashboardEnrollment> Enrollments { get; init; } = [];

    [JsonPropertyName("summary")]
    public ScheduleDashboardSummary Summary { get; init; } = default!;

    /// <summary>
    /// Composes the dashboard from the underlying queries:
    /// schedule entity + its active enrollments + the last-payment-date map for the month.
    /// </summary>
    /// <param name="schedule">Schedule entity loaded by id (Q1).</param>
    /// <param name="month">Year-month label echoed in the response (e.g. <c>2026-05</c>).</param>
    /// <param name="enrollments">Active enrollments for the schedule (Q2).</param>
    /// <param name="lastPaymentDates">
    /// Map <c>enrollmentId → MAX(date)</c> for active payments inside the month window (Q3).
    /// Enrollments not present are treated as debtors (no payment in month).
    /// </param>
    public static ScheduleDashboardResponse From(
        Schedule schedule,
        string month,
        IReadOnlyList<Enrollment> enrollments,
        IReadOnlyDictionary<string, DateOnly> lastPaymentDates)
    {
        var rows = new List<ScheduleDashboardEnrollment>(enrollments.Count);
        var paid = 0;
        foreach (var e in enrollments)
        {
            var hasPayment = lastPaymentDates.TryGetValue(e.Id, out var lastDate);
            if (hasPayment) paid++;
            rows.Add(new ScheduleDashboardEnrollment
            {
                EnrollmentId = e.Id,
                StudentId = e.StudentId,
                StudentName = e.StudentName,
                StudentDoc = e.StudentDoc,
                PaidThisMonth = hasPayment,
                LastPaymentDate = hasPayment ? lastDate : null,
            });
        }

        var enrolledCount = enrollments.Count;
        var summary = new ScheduleDashboardSummary
        {
            Enrolled = enrolledCount,
            Paid = paid,
            Debtors = enrolledCount - paid,
            OccupancyPct = schedule.Capacity > 0
                ? Math.Round((decimal)enrolledCount / schedule.Capacity, 4)
                : 0m,
        };

        return new ScheduleDashboardResponse
        {
            Schedule = ScheduleResponse.From(schedule, enrolledCount),
            Month = month,
            Enrollments = rows,
            Summary = summary,
        };
    }
}

/// <summary>One enrollment row inside the schedule dashboard, with paid/debtor status for the month.</summary>
public sealed record ScheduleDashboardEnrollment
{
    [JsonPropertyName("enrollmentId")]
    public string EnrollmentId { get; init; } = default!;

    [JsonPropertyName("studentId")]
    public string StudentId { get; init; } = default!;

    [JsonPropertyName("studentName")]
    public string StudentName { get; init; } = default!;

    /// <summary>Concatenated <c>docType + docNumber</c> snapshot for display (e.g. <c>DNI 12345678</c>).</summary>
    [JsonPropertyName("studentDoc")]
    public string StudentDoc { get; init; } = default!;

    [JsonPropertyName("paidThisMonth")]
    public bool PaidThisMonth { get; init; }

    /// <summary>Most recent active payment date within the requested month, or <c>null</c> if none.</summary>
    [JsonPropertyName("lastPaymentDate")]
    public DateOnly? LastPaymentDate { get; init; }
}

/// <summary>Aggregate counters for the schedule dashboard month.</summary>
public sealed record ScheduleDashboardSummary
{
    [JsonPropertyName("enrolled")]
    public int Enrolled { get; init; }

    [JsonPropertyName("paid")]
    public int Paid { get; init; }

    [JsonPropertyName("debtors")]
    public int Debtors { get; init; }

    /// <summary>Ratio <c>enrolled / capacity</c>, rounded to 4 decimals. <c>0</c> when capacity is 0.</summary>
    [JsonPropertyName("occupancyPct")]
    public decimal OccupancyPct { get; init; }
}
