using EspacioPro.Domain.Common;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

public class TextNormalizerTests
{
    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("   ", "   ")]
    [InlineData("Hola", "hola")]
    [InlineData("JOSÉ", "jose")]
    [InlineData("José Andrés", "jose andres")]
    [InlineData("Mañana", "manana")]
    [InlineData("Inglés Avanzado", "ingles avanzado")]
    [InlineData("Über", "uber")]
    [InlineData("Café", "cafe")]
    [InlineData("Ñoño", "nono")]
    [InlineData("àÀáÁâÂãÃäÄåÅ", "aaaaaaaaaaaa")]
    [InlineData("èÈéÉêÊëË", "eeeeeeee")]
    [InlineData("ìÌíÍîÎïÏ", "iiiiiiii")]
    [InlineData("òÒóÓôÔõÕöÖ", "oooooooooo")]
    [InlineData("ùÙúÚûÛüÜ", "uuuuuuuu")]
    [InlineData("Plain ASCII 123", "plain ascii 123")]
    public void Normalize_FoldsAccentsAndLowercases(string? input, string expected)
    {
        TextNormalizer.Normalize(input).Should().Be(expected);
    }

    [Fact]
    public void Normalize_PreservesInternalWhitespace()
    {
        TextNormalizer.Normalize("  José   Andrés  ").Should().Be("  jose   andres  ");
    }

    [Theory]
    [InlineData(new string?[] { "José", "Pérez" }, "jose perez")]
    [InlineData(new string?[] { "Inglés", "Avanzado", "Mañana" }, "ingles avanzado manana")]
    [InlineData(new string?[] { "A", null, "B" }, "a b")]
    [InlineData(new string?[] { "A", "", "B" }, "a b")]
    [InlineData(new string?[] { "A", "   ", "B" }, "a b")]
    [InlineData(new string?[] { null, null }, "")]
    [InlineData(new string?[] { }, "")]
    [InlineData(new string?[] { "Único" }, "unico")]
    public void Compose_JoinsSkippingNullOrWhitespaceAndNormalizes(string?[] parts, string expected)
    {
        TextNormalizer.Compose(parts).Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("abc", "")]
    [InlineData("12345678", "12345678")]
    [InlineData("+57 300-123 4567", "573001234567")]
    [InlineData("(011) 4555-1234", "01145551234")]
    [InlineData("+1 (555) 123-4567 ext. 89", "1555123456789")]
    [InlineData("   ", "")]
    [InlineData("phone: 555.123.4567", "5551234567")]
    public void DigitsOnly_ReturnsOnlyDigitCharacters(string? input, string expected)
    {
        TextNormalizer.DigitsOnly(input).Should().Be(expected);
    }
}
