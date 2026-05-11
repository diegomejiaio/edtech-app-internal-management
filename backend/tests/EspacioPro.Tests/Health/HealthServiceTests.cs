using EspacioPro.Application.Health;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Health;

public class HealthServiceTests
{
    [Fact]
    public void GetHealth_ReturnsHealthyStatus()
    {
        var sut = new HealthService();

        var result = sut.GetHealth();

        result.Should().NotBeNull();
        result.Status.Should().Be("healthy");
        result.Version.Should().NotBeNullOrWhiteSpace();
        result.Timestamp.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void GetHealth_TimestampIsValidIso8601Utc()
    {
        var sut = new HealthService();

        var result = sut.GetHealth();
        var parsed = DateTimeOffset.Parse(result.Timestamp);

        parsed.Offset.Should().Be(TimeSpan.Zero, "timestamps are emitted in UTC");
        parsed.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }
}
