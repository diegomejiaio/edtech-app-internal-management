using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Schedule entity. Container: <c>master</c>, partition key: <c>/type</c> = "schedule".
/// Per <c>docs/01-domain-model.md</c> §3.4.
/// </summary>
/// <remarks>
/// <see cref="TeacherName"/> is a denormalized snapshot, refreshed on every PUT
/// from the current Teacher document (api-design §4.2).
/// Computed fields <c>enrolledActiveCount</c> and <c>occupancyPct</c> are NOT stored —
/// they live on <see cref="ScheduleResponse"/> and are derived at read time.
/// </remarks>
public sealed class Schedule : BaseEntity
{
    public override string Type => EntityTypes.Schedule;

    /// <summary>Catalog code from <c>courses</c>. Stored verbatim (Spanish, user-editable).</summary>
    [JsonPropertyName("course")]
    public string Course { get; set; } = default!;

    /// <summary>Catalog code from <c>levels</c>. Stored verbatim.</summary>
    [JsonPropertyName("level")]
    public string Level { get; set; } = default!;

    [JsonPropertyName("teacherId")]
    public string TeacherId { get; set; } = default!;

    /// <summary>Snapshot of teacher's full name. Refreshed on PUT.</summary>
    [JsonPropertyName("teacherName")]
    public string TeacherName { get; set; } = default!;

    /// <summary>Catalog code from <c>weekdays</c> (e.g. "L-V", "S"). Stored verbatim.</summary>
    [JsonPropertyName("weekdays")]
    public string Weekdays { get; set; } = default!;

    [JsonPropertyName("startTime")]
    public TimeOnly StartTime { get; set; }

    [JsonPropertyName("endTime")]
    public TimeOnly EndTime { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("capacity")]
    public int Capacity { get; set; }

    [JsonPropertyName("status")]
    public ScheduleStatus Status { get; set; }

    [JsonPropertyName("startDate")]
    public DateOnly StartDate { get; set; }

    /// <summary>Total expected course duration used to generate sessions.</summary>
    [JsonPropertyName("courseDurationHours")]
    public decimal? CourseDurationHours { get; set; }

    /// <summary>Last generated session date, derived from <see cref="Sessions"/>.</summary>
    [JsonPropertyName("projectedEndDate")]
    public DateOnly? ProjectedEndDate { get; set; }

    /// <summary>Bounded generated class sessions for this schedule.</summary>
    [JsonPropertyName("sessions")]
    public List<ScheduleSession> Sessions { get; set; } = [];

    /// <summary>
    /// Server-computed accent-folded + lowercased projection of
    /// <c>course + level + teacherName + weekdays</c>. Used for
    /// <c>CONTAINS</c> search; never set by clients.
    /// </summary>
    [JsonPropertyName("searchText")]
    public string? SearchText { get; set; }
}

/// <summary>Generated class session embedded in a schedule document.</summary>
public sealed class ScheduleSession
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("D");

    [JsonPropertyName("sequenceNumber")]
    public int SequenceNumber { get; set; }

    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("startTime")]
    public TimeOnly StartTime { get; set; }

    [JsonPropertyName("endTime")]
    public TimeOnly EndTime { get; set; }

    [JsonPropertyName("status")]
    public ScheduleSessionStatus Status { get; set; } = ScheduleSessionStatus.Scheduled;

    [JsonPropertyName("attendance")]
    public List<ScheduleAttendance> Attendance { get; set; } = [];

    [JsonPropertyName("active")]
    public bool Active { get; set; } = true;

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    [JsonPropertyName("createdBy")]
    public AuditUser? CreatedBy { get; set; }

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    [JsonPropertyName("updatedBy")]
    public AuditUser? UpdatedBy { get; set; }

    [JsonPropertyName("deletedAt")]
    public string? DeletedAt { get; set; }

    [JsonPropertyName("deletedBy")]
    public AuditUser? DeletedBy { get; set; }
}

/// <summary>Per-student attendance entry embedded in a schedule session.</summary>
public sealed class ScheduleAttendance
{
    [JsonPropertyName("enrollmentId")]
    public string EnrollmentId { get; set; } = default!;

    [JsonPropertyName("studentId")]
    public string StudentId { get; set; } = default!;

    [JsonPropertyName("studentName")]
    public string StudentName { get; set; } = default!;

    [JsonPropertyName("status")]
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Pending;

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("updatedAt")]
    public string? UpdatedAt { get; set; }

    [JsonPropertyName("updatedBy")]
    public AuditUser? UpdatedBy { get; set; }
}
