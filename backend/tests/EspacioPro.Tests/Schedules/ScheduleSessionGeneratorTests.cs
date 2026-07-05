using EspacioPro.Application.Schedules;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Schedules;

public class ScheduleWeekdayParserTests
{
    [Theory]
    [InlineData("Ma", DayOfWeek.Tuesday)]
    [InlineData("Mi", DayOfWeek.Wednesday)]
    [InlineData("LMiV", DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday)]
    [InlineData("MaJ", DayOfWeek.Tuesday, DayOfWeek.Thursday)]
    [InlineData("L-V", DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday)]
    public void TryParse_SupportsCanonicalCodes(string code, params DayOfWeek[] expected)
    {
        ScheduleWeekdayParser.TryParse(code, out var actual).Should().BeTrue();

        actual.Should().BeEquivalentTo(expected);
    }

    [Theory]
    [InlineData("M", "Ma")]
    [InlineData("LMV", "LMiV")]
    [InlineData("MJ", "MaJ")]
    [InlineData(" Ma ", "Ma")]
    public void TryNormalizeCanonical_MapsLegacyAliases(string input, string expected)
    {
        ScheduleWeekdayParser.TryNormalizeCanonical(input, out var actual).Should().BeTrue();

        actual.Should().Be(expected);
    }
}

public class ScheduleSessionGeneratorTests
{
    [Fact]
    public void Generate_UsesCourseDurationAndSessionDuration()
    {
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));

        var sessions = ScheduleSessionGenerator.Generate(schedule, courseDurationHours: 16m, auditUser: null);

        sessions.Should().HaveCount(8);
        sessions.Select(s => s.Date).Should().Equal(
            new DateOnly(2026, 6, 1),
            new DateOnly(2026, 6, 3),
            new DateOnly(2026, 6, 5),
            new DateOnly(2026, 6, 8),
            new DateOnly(2026, 6, 10),
            new DateOnly(2026, 6, 12),
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 17));
        sessions.Should().OnlyContain(s => s.Status == ScheduleSessionStatus.Scheduled);
    }

    [Fact]
    public void ApplyProjection_UsesLastActiveGeneratedDate()
    {
        var schedule = SampleSchedule("MaJ", new DateOnly(2026, 6, 2));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];

        ScheduleSessionGenerator.ApplyProjection(schedule);

        schedule.ProjectedEndDate.Should().Be(new DateOnly(2026, 6, 9));
    }

    [Fact]
    public void RegeneratePreservingFinalized_RejectsRecordedAttendance()
    {
        var schedule = SampleSchedule("L", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 2m, null)];
        schedule.Sessions[0].Attendance.Add(new ScheduleAttendance
        {
            StudentId = "std-1",
            StudentName = "Ana",
            Status = AttendanceStatus.Present,
        });

        Action act = () => ScheduleSessionGenerator.RegeneratePreservingFinalized(schedule, 2m, null);

        act.Should().Throw<ScheduleSessionRegenerationException>();
    }

    [Fact]
    public void ApplyProjection_UsesMaxDate_WhenSessionRescheduledOutOfOrder()
    {
        var schedule = SampleSchedule("MaJ", new DateOnly(2026, 6, 2));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];

        // Reschedule the first session past the last one (later date, lower sequenceNumber).
        schedule.Sessions[0].Date = new DateOnly(2026, 6, 30);

        ScheduleSessionGenerator.ApplyProjection(schedule);

        schedule.ProjectedEndDate.Should().Be(new DateOnly(2026, 6, 30));
    }

    [Fact]
    public void ShiftScheduledSessions_MovesAllScheduledSessionsByDelta()
    {
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];
        var originalDates = schedule.Sessions.Select(s => s.Date).ToArray();

        ScheduleSessionGenerator.ShiftScheduledSessions(schedule, deltaDays: 7, auditUser: null);

        schedule.Sessions.Select(s => s.Date).Should().Equal(originalDates.Select(d => d.AddDays(7)));
    }

    [Fact]
    public void ShiftScheduledSessions_PreservesFinalizedAndAttendedSessions()
    {
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];
        schedule.Sessions[0].Status = ScheduleSessionStatus.Completed;
        schedule.Sessions[1].Attendance.Add(new ScheduleAttendance
        {
            StudentId = "std-1",
            StudentName = "Ana",
            Status = AttendanceStatus.Present,
        });
        var completedDate = schedule.Sessions[0].Date;
        var attendedDate = schedule.Sessions[1].Date;
        var scheduledDate = schedule.Sessions[2].Date;

        ScheduleSessionGenerator.ShiftScheduledSessions(schedule, deltaDays: 7, auditUser: null);

        schedule.Sessions[0].Date.Should().Be(completedDate);
        schedule.Sessions[1].Date.Should().Be(attendedDate);
        schedule.Sessions[2].Date.Should().Be(scheduledDate.AddDays(7));
    }

    [Fact]
    public void SyncStartDateToEarliestSession_SetsStartDateToMinActiveSession()
    {
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];

        // Move the first session forward so a later session becomes the earliest.
        schedule.Sessions[0].Date = new DateOnly(2026, 6, 30);

        ScheduleSessionGenerator.SyncStartDateToEarliestSession(schedule);

        schedule.StartDate.Should().Be(new DateOnly(2026, 6, 3));
    }

    [Fact]
    public void SyncStartDateToEarliestSession_TracksRescheduledFirstSession()
    {
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];

        // Move the first session earlier: start date should follow it.
        schedule.Sessions[0].Date = new DateOnly(2026, 5, 25);

        ScheduleSessionGenerator.SyncStartDateToEarliestSession(schedule);

        schedule.StartDate.Should().Be(new DateOnly(2026, 5, 25));
    }

    [Fact]
    public void StartDateShift_ThenSync_MovesWholePlanToNewStart()
    {
        // Mirrors ScheduleFunction.Update pure-startDate-change flow: shift by delta, then sync.
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];
        var newStart = new DateOnly(2026, 6, 8);
        var delta = newStart.DayNumber - schedule.StartDate.DayNumber;

        ScheduleSessionGenerator.ShiftScheduledSessions(schedule, delta, null);
        ScheduleSessionGenerator.SyncStartDateToEarliestSession(schedule);

        schedule.StartDate.Should().Be(newStart);
        schedule.Sessions[0].Date.Should().Be(newStart);
        schedule.Sessions.Select(s => s.Date).Should().Equal(
            new DateOnly(2026, 6, 8),
            new DateOnly(2026, 6, 10),
            new DateOnly(2026, 6, 12));
    }

    [Fact]
    public void StartDateShift_WithHeldFirstSession_ReSyncsStartToHeldSession()
    {
        // Edge case: the first session was already held. The shift moves only upcoming sessions,
        // and the sync keeps startDate anchored to the held session (a started course cannot move
        // its start), never losing data.
        var schedule = SampleSchedule("LMiV", new DateOnly(2026, 6, 1));
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, 6m, null)];
        schedule.Sessions[0].Status = ScheduleSessionStatus.Completed;
        var heldDate = schedule.Sessions[0].Date;
        var newStart = new DateOnly(2026, 6, 8);
        var delta = newStart.DayNumber - schedule.StartDate.DayNumber;

        ScheduleSessionGenerator.ShiftScheduledSessions(schedule, delta, null);
        ScheduleSessionGenerator.SyncStartDateToEarliestSession(schedule);

        schedule.Sessions[0].Date.Should().Be(heldDate);
        schedule.StartDate.Should().Be(heldDate);
        schedule.Sessions[1].Date.Should().Be(new DateOnly(2026, 6, 10));
    }

    private static Schedule SampleSchedule(string weekdays, DateOnly startDate) => new()
    {
        Id = "sch-1",
        Course = "Melamina",
        Level = "Principiante",
        TeacherId = "tch-1",
        TeacherName = "Docente",
        Weekdays = weekdays,
        StartDate = startDate,
        StartTime = new TimeOnly(18, 0),
        EndTime = new TimeOnly(20, 0),
        Price = 250m,
        Capacity = 12,
        Status = ScheduleStatus.Active,
    };
}
