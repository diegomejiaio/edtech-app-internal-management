using EspacioPro.Domain.Common;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

public class ShortCodeGeneratorTests
{
    [Theory]
    [InlineData("HOR-", 5)]
    [InlineData("", 8)]
    [InlineData("X", 1)]
    public void Generate_HasPrefixAndLength(string prefix, int length)
    {
        var code = ShortCodeGenerator.Generate(prefix, length);

        code.Should().StartWith(prefix);
        code.Length.Should().Be(prefix.Length + length);
    }

    [Fact]
    public void Generate_UsesOnlyCrockfordAlphabet_ExcludingAmbiguousChars()
    {
        for (var i = 0; i < 200; i++)
        {
            var suffix = ShortCodeGenerator.Generate("HOR-", 5)["HOR-".Length..];

            suffix.Should().MatchRegex("^[0-9A-HJKMNP-TV-Z]+$");
            suffix.Should().NotContainAny("I", "L", "O", "U");
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void Generate_RejectsNonPositiveLength(int length)
    {
        var act = () => ShortCodeGenerator.Generate("HOR-", length);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task GenerateUniqueAsync_ReturnsFirstNonCollidingCode()
    {
        var taken = new HashSet<string>();
        var calls = 0;

        var code = await ShortCodeGenerator.GenerateUniqueAsync(
            (candidate, _) =>
            {
                calls++;
                // Force one collision then accept.
                if (calls == 1)
                {
                    taken.Add(candidate);
                    return Task.FromResult(true);
                }

                return Task.FromResult(taken.Contains(candidate));
            },
            "HOR-",
            5,
            ct: TestContext.Current.CancellationToken);

        code.Should().StartWith("HOR-");
        calls.Should().BeGreaterThanOrEqualTo(2);
        taken.Should().NotContain(code);
    }

    [Fact]
    public async Task GenerateUniqueAsync_ThrowsWhenAllAttemptsCollide()
    {
        var act = async () => await ShortCodeGenerator.GenerateUniqueAsync(
            (_, _) => Task.FromResult(true),
            "HOR-",
            5,
            maxAttempts: 3);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
