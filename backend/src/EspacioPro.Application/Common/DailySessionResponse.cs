using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Common;

/// <summary>
/// Read-only projection of a single class session on a given date, flattened together with
/// its parent <see cref="Schedule"/> context. Powers
/// <c>GET /api/v1/sessions?date=YYYY-MM-DD</c> (used by the Telegram agent to answer
/// "clases de hoy" and by the dashboard). Derived at request time, never persisted.
/// </summary>
public sealed record DailySessionResponse
{
    [JsonPropertyName("scheduleId")]
    public string ScheduleId { get; init; } = default!;

    /// <summary>Human-friendly schedule code (e.g. <c>HOR-7Q3K9</c>), when present.</summary>
    [JsonPropertyName("scheduleCode")]
    public string? ScheduleCode { get; init; }

    /// <summary>Start date of the parent schedule — the canonical way to identify a schedule.</summary>
    [JsonPropertyName("scheduleStartDate")]
    public DateOnly ScheduleStartDate { get; init; }

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

    [JsonPropertyName("sessionId")]
    public string SessionId { get; init; } = default!;

    [JsonPropertyName("sequenceNumber")]
    public int SequenceNumber { get; init; }

    [JsonPropertyName("date")]
    public DateOnly Date { get; init; }

    [JsonPropertyName("startTime")]
    public TimeOnly StartTime { get; init; }

    [JsonPropertyName("endTime")]
    public TimeOnly EndTime { get; init; }

    [JsonPropertyName("status")]
    public ScheduleSessionStatus Status { get; init; }

    /// <summary>Number of attendance entries recorded on the session (0 when not yet taken).</summary>
    [JsonPropertyName("attendanceCount")]
    public int AttendanceCount { get; init; }

    /// <summary>Projects a session and its parent schedule into a flat daily-session row.</summary>
    public static DailySessionResponse From(Schedule schedule, ScheduleSession session) => new()
    {
        ScheduleId = schedule.Id,
        ScheduleCode = schedule.Code,
        ScheduleStartDate = schedule.StartDate,
        Course = schedule.Course,
        Level = schedule.Level,
        TeacherId = schedule.TeacherId,
        TeacherName = schedule.TeacherName,
        Weekdays = schedule.Weekdays,
        SessionId = session.Id,
        SequenceNumber = session.SequenceNumber,
        Date = session.Date,
        StartTime = session.StartTime,
        EndTime = session.EndTime,
        Status = session.Status,
        AttendanceCount = session.Attendance?.Count ?? 0,
    };
}
