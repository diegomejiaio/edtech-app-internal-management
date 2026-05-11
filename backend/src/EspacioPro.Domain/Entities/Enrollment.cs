using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Enrollment entity. Container: <c>operations</c>, partition key: <c>/type</c> = "enrollment".
/// Per <c>docs/01-domain-model.md</c> §3.5 and <c>docs/04-api-design.md</c> §4.2.
/// </summary>
/// <remarks>
/// Carries denormalized snapshots from <c>Student</c> and <c>Schedule</c>. Snapshots are
/// refreshed on every PUT (api-design §4.2), frozen otherwise. Stale data is acceptable
/// (same trade-off pattern as <c>AuditUser</c>).
/// </remarks>
public sealed class Enrollment : BaseEntity
{
    public override string Type => EntityTypes.Enrollment;

    [JsonPropertyName("studentId")]
    public string StudentId { get; set; } = default!;

    /// <summary>Snapshot: student full name. Refreshed on PUT.</summary>
    [JsonPropertyName("studentName")]
    public string StudentName { get; set; } = default!;

    /// <summary>Snapshot: e.g. "DNI 12345678". Refreshed on PUT.</summary>
    [JsonPropertyName("studentDoc")]
    public string StudentDoc { get; set; } = default!;

    [JsonPropertyName("scheduleId")]
    public string ScheduleId { get; set; } = default!;

    /// <summary>Snapshot: e.g. "Melamina · Intermedio · L-V 18:00". Refreshed on PUT.</summary>
    [JsonPropertyName("scheduleName")]
    public string ScheduleName { get; set; } = default!;

    /// <summary>Snapshot: schedule price at refresh time. Refreshed on PUT.</summary>
    [JsonPropertyName("schedulePrice")]
    public decimal SchedulePrice { get; set; }

    [JsonPropertyName("enrollmentDate")]
    public DateOnly EnrollmentDate { get; set; }

    [JsonPropertyName("status")]
    public EnrollmentStatus Status { get; set; }
}
