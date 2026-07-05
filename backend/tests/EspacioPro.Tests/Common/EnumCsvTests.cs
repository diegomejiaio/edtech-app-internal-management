using EspacioPro.Domain.Common;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

public class EnumCsvTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryParse_EmptyInput_YieldsEmptyListAndTrue(string? raw)
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>(raw, out var values);

        ok.Should().BeTrue();
        values.Should().BeEmpty();
    }

    [Fact]
    public void TryParse_SingleValue_ReturnsOneItem()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>("active", out var values);

        ok.Should().BeTrue();
        values.Should().ContainSingle().Which.Should().Be(ScheduleStatus.Active);
    }

    [Fact]
    public void TryParse_MultipleValues_PreservesOrder()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>("active,inProgress", out var values);

        ok.Should().BeTrue();
        values.Should().Equal(ScheduleStatus.Active, ScheduleStatus.InProgress);
    }

    [Fact]
    public void TryParse_IsCaseInsensitive()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>("ACTIVE,InProgress", out var values);

        ok.Should().BeTrue();
        values.Should().Equal(ScheduleStatus.Active, ScheduleStatus.InProgress);
    }

    [Fact]
    public void TryParse_TrimsWhitespaceAndSkipsEmptyTokens()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>(" active , inProgress ,", out var values);

        ok.Should().BeTrue();
        values.Should().Equal(ScheduleStatus.Active, ScheduleStatus.InProgress);
    }

    [Fact]
    public void TryParse_DeduplicatesRepeatedTokens()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>("active,active,inProgress", out var values);

        ok.Should().BeTrue();
        values.Should().Equal(ScheduleStatus.Active, ScheduleStatus.InProgress);
    }

    [Fact]
    public void TryParse_InvalidToken_ReturnsFalse()
    {
        var ok = EnumCsv.TryParse<ScheduleStatus>("active,bogus", out _);

        ok.Should().BeFalse();
    }

    [Fact]
    public void TryParse_WorksForEnrollmentStatus()
    {
        var ok = EnumCsv.TryParse<EnrollmentStatus>("active,pending", out var values);

        ok.Should().BeTrue();
        values.Should().Equal(EnrollmentStatus.Active, EnrollmentStatus.Pending);
    }
}
