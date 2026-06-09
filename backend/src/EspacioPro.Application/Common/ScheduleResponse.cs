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
public sealed record ScheduleResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = default!;

    [JsonPropertyName("type")]
    public string Type { get; init; } = EntityTypes.Schedule;

    [JsonPropertyName("code")]
    public string? Code { get; init; }

    [JsonPropertyName("course")]
    public string Course { get; init; } = default!;

    [JsonPropertyName("level")]
    public string Level { get; init; } = default!;

    [JsonPropertyName("teacherId")]
    public string TeacherId { get; init; } = default!;

    [JsonPropertyName("teacherName")]
    public string TeacherName { get; init; } = default!;

    [JsonPropertyName("weekdays")]
    public string Weekdays { get; init; } = default!;

    [JsonPropertyName("startTime")]
    public TimeOnly StartTime { get; init; }

    [JsonPropertyName("endTime")]
    public TimeOnly EndTime { get; init; }

    [JsonPropertyName("price")]
    public decimal Price { get; init; }

    [JsonPropertyName("capacity")]
    public int Capacity { get; init; }

    [JsonPropertyName("status")]
    public ScheduleStatus Status { get; init; }

    [JsonPropertyName("startDate")]
    public DateOnly StartDate { get; init; }

    [JsonPropertyName("courseDurationHours")]
    public decimal? CourseDurationHours { get; init; }

    [JsonPropertyName("projectedEndDate")]
    public DateOnly? ProjectedEndDate { get; init; }

    [JsonPropertyName("active")]
    public bool Active { get; init; }

    [JsonPropertyName("enrolledActiveCount")]
    public int EnrolledActiveCount { get; init; }

    [JsonPropertyName("occupancyPct")]
    public decimal OccupancyPct { get; init; }

    [JsonPropertyName("sessionCount")]
    public int SessionCount { get; init; }

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; init; } = default!;

    [JsonPropertyName("createdBy")]
    public AuditUser? CreatedBy { get; init; }

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; init; } = default!;

    [JsonPropertyName("updatedBy")]
    public AuditUser? UpdatedBy { get; init; }

    [JsonPropertyName("deletedAt")]
    public string? DeletedAt { get; init; }

    [JsonPropertyName("deletedBy")]
    public AuditUser? DeletedBy { get; init; }

    [JsonPropertyName("_etag")]
    public string? ETag { get; init; }

    /// <summary>Composes a response from a <see cref="Schedule"/> + a precomputed enrollment count.</summary>
    public static ScheduleResponse From(Schedule s, int enrolledActiveCount) => new()
    {
        Id = s.Id,
        Type = s.Type,
        Code = s.Code,
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
        CourseDurationHours = s.CourseDurationHours,
        ProjectedEndDate = s.ProjectedEndDate,
        Active = s.Active,
        EnrolledActiveCount = enrolledActiveCount,
        OccupancyPct = s.Capacity > 0
            ? Math.Round((decimal)enrolledActiveCount / s.Capacity, 4)
            : 0m,
        SessionCount = s.Sessions.Count(session => session.Active),
        CreatedAt = s.CreatedAt,
        CreatedBy = s.CreatedBy,
        UpdatedAt = s.UpdatedAt,
        UpdatedBy = s.UpdatedBy,
        DeletedAt = s.DeletedAt,
        DeletedBy = s.DeletedBy,
        ETag = s.ETag,
    };
}
