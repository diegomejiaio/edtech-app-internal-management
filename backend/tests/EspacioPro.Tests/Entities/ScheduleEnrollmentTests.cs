using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Entities;

public class ScheduleTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        new Schedule().Type.Should().Be(EntityTypes.Schedule).And.Be("schedule");
    }
}

public class EnrollmentTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        new Enrollment().Type.Should().Be(EntityTypes.Enrollment).And.Be("enrollment");
    }
}

public class ScheduleResponseTests
{
    private static Schedule SampleSchedule(int capacity) => new()
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

    [Fact]
    public void From_ZeroCapacity_OccupancyIsZero()
    {
        var dto = ScheduleResponse.From(SampleSchedule(0), enrolledActiveCount: 5);

        dto.Capacity.Should().Be(0);
        dto.EnrolledActiveCount.Should().Be(5);
        dto.OccupancyPct.Should().Be(0m, "guard against divide-by-zero");
    }

    [Fact]
    public void From_HalfFull_OccupancyIsHalf()
    {
        var dto = ScheduleResponse.From(SampleSchedule(20), enrolledActiveCount: 10);

        dto.OccupancyPct.Should().Be(0.5m);
    }

    [Fact]
    public void From_PreservesAuditAndEtag()
    {
        var s = SampleSchedule(10);
        s.ETag = "\"abc\"";
        s.CreatedAt = "2026-05-10T00:00:00.0000000Z";
        s.CreatedBy = new AuditUser("user_1", "u@e.com", "Tester");

        var dto = ScheduleResponse.From(s, 3);

        dto.ETag.Should().Be("\"abc\"");
        dto.CreatedBy!.Email.Should().Be("u@e.com");
    }
}

public class TimeOnlyHHmmJsonConverterTests
{
    private static readonly System.Text.Json.JsonSerializerOptions Options = new()
    {
        Converters = { new TimeOnlyHHmmJsonConverter() }
    };

    [Theory]
    [InlineData("\"18:30\"", 18, 30)]
    [InlineData("\"00:00\"", 0, 0)]
    [InlineData("\"23:59\"", 23, 59)]
    public void Read_ParsesHHmm(string json, int hour, int minute)
    {
        var t = System.Text.Json.JsonSerializer.Deserialize<TimeOnly>(json, Options);
        t.Hour.Should().Be(hour);
        t.Minute.Should().Be(minute);
    }

    [Fact]
    public void Read_AlsoAcceptsHHmmss_ButTruncatesToMinutes()
    {
        var t = System.Text.Json.JsonSerializer.Deserialize<TimeOnly>("\"18:30:45\"", Options);
        t.Hour.Should().Be(18);
        t.Minute.Should().Be(30);
        t.Second.Should().Be(0, "the converter normalizes to HH:mm");
    }

    [Fact]
    public void Write_EmitsHHmm()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new TimeOnly(8, 5), Options);
        json.Should().Be("\"08:05\"");
    }
}
