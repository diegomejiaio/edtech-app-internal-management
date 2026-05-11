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
}
