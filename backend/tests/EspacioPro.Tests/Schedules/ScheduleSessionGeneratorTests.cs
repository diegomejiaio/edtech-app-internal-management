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
