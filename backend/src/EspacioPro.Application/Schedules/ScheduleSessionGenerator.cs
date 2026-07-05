using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Schedules;

/// <summary>Generates bounded schedule sessions from duration, dates, times, and weekdays.</summary>
public static class ScheduleSessionGenerator
{
    public static IReadOnlyList<ScheduleSession> Generate(
        Schedule schedule,
        decimal courseDurationHours,
        AuditUser? auditUser,
        DateTimeOffset? now = null)
    {
        if (!ScheduleWeekdayParser.TryParse(schedule.Weekdays, out var weekdays))
            throw new ArgumentException($"Unsupported weekday code '{schedule.Weekdays}'.", nameof(schedule));

        var sessionDurationMinutes = (schedule.EndTime - schedule.StartTime).TotalMinutes;
        if (sessionDurationMinutes <= 0)
            throw new ArgumentException("Schedule endTime must be later than startTime.", nameof(schedule));

        var totalMinutes = decimal.ToDouble(courseDurationHours * 60m);
        var sessionsNeeded = (int)Math.Ceiling(totalMinutes / sessionDurationMinutes);
        if (sessionsNeeded <= 0)
            return [];

        var timestamp = (now ?? DateTimeOffset.UtcNow).UtcDateTime.ToString("o");
        var sessions = new List<ScheduleSession>(sessionsNeeded);
        var current = schedule.StartDate;

        while (sessions.Count < sessionsNeeded)
        {
            if (weekdays.Contains(current.DayOfWeek))
            {
                sessions.Add(new ScheduleSession
                {
                    SequenceNumber = sessions.Count + 1,
                    Date = current,
                    StartTime = schedule.StartTime,
                    EndTime = schedule.EndTime,
                    Status = ScheduleSessionStatus.Scheduled,
                    CreatedAt = timestamp,
                    CreatedBy = auditUser,
                    UpdatedAt = timestamp,
                    UpdatedBy = auditUser,
                });
            }

            current = current.AddDays(1);
        }

        return sessions;
    }

    public static bool RequiresRegeneration(Schedule existing, Schedule updated) =>
        existing.Course != updated.Course
        || existing.Level != updated.Level
        || existing.Weekdays != updated.Weekdays
        || existing.StartDate != updated.StartDate
        || existing.StartTime != updated.StartTime
        || existing.EndTime != updated.EndTime;

    public static bool HasRecordedAttendance(ScheduleSession session) =>
        session.Attendance.Any(a => a.Status != AttendanceStatus.Pending);

    public static IReadOnlyList<ScheduleSession> RegeneratePreservingFinalized(
        Schedule updated,
        decimal courseDurationHours,
        AuditUser? auditUser)
    {
        var existing = updated.Sessions;
        var unsafeSession = existing.FirstOrDefault(s =>
            s.Active
            && (s.Status is ScheduleSessionStatus.Completed or ScheduleSessionStatus.Cancelled
                || HasRecordedAttendance(s)));
        if (unsafeSession is not null)
        {
            throw new ScheduleSessionRegenerationException(
                $"Cannot regenerate sessions because session {unsafeSession.SequenceNumber} already has final status or recorded attendance.");
        }

        return Generate(updated, courseDurationHours, auditUser);
    }

    public static void ApplyProjection(Schedule schedule)
    {
        schedule.ProjectedEndDate = schedule.Sessions
            .Where(s => s.Active)
            .OrderBy(s => s.Date)
            .ThenBy(s => s.SequenceNumber)
            .LastOrDefault()
            ?.Date;
    }

    /// <summary>
    /// Shifts every movable active session (Scheduled status, no recorded attendance) by
    /// <paramref name="deltaDays"/>, preserving finalized/attended sessions in place. Powers
    /// non-destructive start-date edits: the plan moves without discarding already-held classes
    /// or manual reschedules, and without the destructive full regeneration.
    /// </summary>
    public static void ShiftScheduledSessions(
        Schedule schedule,
        int deltaDays,
        AuditUser? auditUser,
        DateTimeOffset? now = null)
    {
        if (deltaDays == 0)
            return;

        var timestamp = (now ?? DateTimeOffset.UtcNow).UtcDateTime.ToString("o");
        foreach (var session in schedule.Sessions)
        {
            if (!session.Active
                || session.Status is ScheduleSessionStatus.Completed or ScheduleSessionStatus.Cancelled
                || HasRecordedAttendance(session))
                continue;

            session.Date = session.Date.AddDays(deltaDays);
            session.UpdatedAt = timestamp;
            session.UpdatedBy = auditUser;
        }
    }

    /// <summary>
    /// Re-derives <see cref="Schedule.StartDate"/> from the earliest active session, keeping the
    /// schedule's start date in sync with its first session (single source of truth). No-op when
    /// the schedule has no active sessions.
    /// </summary>
    public static void SyncStartDateToEarliestSession(Schedule schedule)
    {
        var earliest = schedule.Sessions
            .Where(s => s.Active)
            .OrderBy(s => s.Date)
            .ThenBy(s => s.SequenceNumber)
            .FirstOrDefault();
        if (earliest is not null)
            schedule.StartDate = earliest.Date;
    }
}

public sealed class ScheduleSessionRegenerationException : Exception
{
    public ScheduleSessionRegenerationException(string message) : base(message) { }
}

