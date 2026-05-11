using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Common;

/// <summary>
/// Read-side view of a <see cref="Schedule"/> with computed metrics
/// (<c>enrolledActiveCount</c>, <c>occupancyPct</c>) per
/// <c>docs/01-domain-model.md</c> §3.4 and <c>docs/04-api-design.md</c> §4.3.
/// Computed fields are derived at request time and never persisted.
/// </summary>
public sealed class ScheduleResponse
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = default!;

    [JsonPropertyName("type")]
    public string Type { get; set; } = EntityTypes.Schedule;

    [JsonPropertyName("course")]
    public string Course { get; set; } = default!;

    [JsonPropertyName("level")]
    public string Level { get; set; } = default!;

    [JsonPropertyName("teacherId")]
    public string TeacherId { get; set; } = default!;

    [JsonPropertyName("teacherName")]
    public string TeacherName { get; set; } = default!;

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

    [JsonPropertyName("active")]
    public bool Active { get; set; }

    [JsonPropertyName("enrolledActiveCount")]
    public int EnrolledActiveCount { get; set; }

    [JsonPropertyName("occupancyPct")]
    public decimal OccupancyPct { get; set; }

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = default!;

    [JsonPropertyName("createdBy")]
    public AuditUser? CreatedBy { get; set; }

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = default!;

    [JsonPropertyName("updatedBy")]
    public AuditUser? UpdatedBy { get; set; }

    [JsonPropertyName("deletedAt")]
    public string? DeletedAt { get; set; }

    [JsonPropertyName("deletedBy")]
    public AuditUser? DeletedBy { get; set; }

    [JsonPropertyName("_etag")]
    public string? ETag { get; set; }

    /// <summary>Composes a response from a <see cref="Schedule"/> + a precomputed enrollment count.</summary>
    public static ScheduleResponse From(Schedule s, int enrolledActiveCount) => new()
    {
        Id = s.Id,
        Type = s.Type,
        Course = s.Course,
        Level = s.Level,
        TeacherId = s.TeacherId,
        TeacherName = s.TeacherName,
        Weekdays = s.Weekdays,
        StartTime = s.StartTime,
        EndTime = s.EndTime,
        Price = s.Price,
        Capacity = s.Capacity,
        Status = s.Status,
        StartDate = s.StartDate,
        Active = s.Active,
        EnrolledActiveCount = enrolledActiveCount,
        OccupancyPct = s.Capacity > 0
            ? Math.Round((decimal)enrolledActiveCount / s.Capacity, 4)
            : 0m,
        CreatedAt = s.CreatedAt,
        CreatedBy = s.CreatedBy,
        UpdatedAt = s.UpdatedAt,
        UpdatedBy = s.UpdatedBy,
        DeletedAt = s.DeletedAt,
        DeletedBy = s.DeletedBy,
        ETag = s.ETag,
    };
}
