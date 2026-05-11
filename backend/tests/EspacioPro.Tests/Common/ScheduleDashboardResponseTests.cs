using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

/// <summary>
/// Composition tests for the M9 schedule dashboard DTO. Covers paid/debtor flagging,
/// summary counters, and occupancy edge cases. No Cosmos contact.
/// </summary>
public class ScheduleDashboardResponseTests
{
    private static Schedule SampleSchedule(int capacity = 10) => new()
    {
        Id = "sch-1",
        Course = "Melamina",
        Level = "Intermedio",
        TeacherId = "tch-1",
        TeacherName = "Diego Mejia",
        Weekdays = "L-V",
        StartTime = new TimeOnly(18, 0),
        EndTime = new TimeOnly(20, 0),
        Price = 250m,
        Capacity = capacity,
        Status = ScheduleStatus.Active,
        StartDate = new DateOnly(2026, 6, 1),
    };

    private static Enrollment SampleEnrollment(string id, string studentName) => new()
    {
        Id = id,
        StudentId = $"std-{id}",
        StudentName = studentName,
        StudentDoc = "DNI 12345678",
        ScheduleId = "sch-1",
        ScheduleName = "Melamina · Intermedio · L-V 18:00",
        Status = EnrollmentStatus.Active,
        EnrollmentDate = new DateOnly(2026, 5, 1),
    };

    [Fact]
    public void From_FlagsPaidEnrollments_AndComputesSummary()
    {
        var schedule = SampleSchedule(capacity: 10);
        var enrollments = new List<Enrollment>
        {
            SampleEnrollment("e1", "Ana"),
            SampleEnrollment("e2", "Ben"),
            SampleEnrollment("e3", "Caro"),
        };
        var lastDates = new Dictionary<string, DateOnly>
        {
            ["e1"] = new(2026, 5, 3),
            ["e3"] = new(2026, 5, 28),
        };

        var dto = ScheduleDashboardResponse.From(schedule, "2026-05", enrollments, lastDates);

        dto.Schedule.Id.Should().Be("sch-1");
        dto.Schedule.EnrolledActiveCount.Should().Be(3);
        dto.Month.Should().Be("2026-05");
        dto.Enrollments.Should().HaveCount(3);
        dto.Enrollments.Should().Contain(e => e.EnrollmentId == "e1" && e.PaidThisMonth && e.LastPaymentDate == new DateOnly(2026, 5, 3));
        dto.Enrollments.Should().Contain(e => e.EnrollmentId == "e2" && !e.PaidThisMonth && e.LastPaymentDate == null);
        dto.Enrollments.Should().Contain(e => e.EnrollmentId == "e3" && e.PaidThisMonth && e.LastPaymentDate == new DateOnly(2026, 5, 28));

        dto.Summary.Enrolled.Should().Be(3);
        dto.Summary.Paid.Should().Be(2);
        dto.Summary.Debtors.Should().Be(1);
        dto.Summary.OccupancyPct.Should().Be(0.3m);
    }

    [Fact]
    public void From_NoEnrollments_ReturnsEmptyList_AndZeroSummary()
    {
        var dto = ScheduleDashboardResponse.From(
            SampleSchedule(capacity: 10),
            "2026-05",
            enrollments: [],
            lastPaymentDates: new Dictionary<string, DateOnly>());

        dto.Enrollments.Should().BeEmpty();
        dto.Summary.Enrolled.Should().Be(0);
        dto.Summary.Paid.Should().Be(0);
        dto.Summary.Debtors.Should().Be(0);
        dto.Summary.OccupancyPct.Should().Be(0m);
    }

    [Fact]
    public void From_ZeroCapacity_OccupancyIsZero()
    {
        var dto = ScheduleDashboardResponse.From(
            SampleSchedule(capacity: 0),
            "2026-05",
            enrollments: [SampleEnrollment("e1", "Ana")],
            lastPaymentDates: new Dictionary<string, DateOnly> { ["e1"] = new(2026, 5, 3) });

        dto.Summary.Enrolled.Should().Be(1);
        dto.Summary.Paid.Should().Be(1);
        dto.Summary.OccupancyPct.Should().Be(0m);
    }

    [Fact]
    public void From_AllPaid_SummaryHasNoDebtors()
    {
        var enrollments = new[] { SampleEnrollment("e1", "Ana"), SampleEnrollment("e2", "Ben") };
        var lastDates = new Dictionary<string, DateOnly>
        {
            ["e1"] = new(2026, 5, 1),
            ["e2"] = new(2026, 5, 2),
        };

        var dto = ScheduleDashboardResponse.From(SampleSchedule(4), "2026-05", enrollments, lastDates);

        dto.Summary.Paid.Should().Be(2);
        dto.Summary.Debtors.Should().Be(0);
        dto.Summary.OccupancyPct.Should().Be(0.5m);
    }

    [Fact]
    public void From_StalePaymentForUnknownEnrollment_IsIgnored()
    {
        // Caller may pass a wider lastPaymentDates map; only present enrollments are flagged.
        var enrollments = new[] { SampleEnrollment("e1", "Ana") };
        var lastDates = new Dictionary<string, DateOnly>
        {
            ["e1"] = new(2026, 5, 1),
            ["e-unknown"] = new(2026, 5, 9),
        };

        var dto = ScheduleDashboardResponse.From(SampleSchedule(2), "2026-05", enrollments, lastDates);

        dto.Enrollments.Should().HaveCount(1);
        dto.Summary.Paid.Should().Be(1);
    }
}
