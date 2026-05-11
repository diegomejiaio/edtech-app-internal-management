using EspacioPro.Domain.Common;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

public class DocumentValidationTests
{
    [Theory]
    [InlineData(DocType.Dni, "12345678", true)]
    [InlineData(DocType.Dni, "1234567", false)]
    [InlineData(DocType.Dni, "abcdefgh", false)]
    [InlineData(DocType.Dni, "", false)]
    [InlineData(DocType.Ce, "ABC123456", true)]
    [InlineData(DocType.Ce, "ABC1234", false)]
    [InlineData(DocType.Passport, "P12345", true)]
    [InlineData(DocType.Passport, "P12", false)]
    public void IsValid_RespectsRulesPerDocType(DocType docType, string docNumber, bool expected)
    {
        DocumentValidation.IsValid(docType, docNumber).Should().Be(expected);
    }
}

public class EmailValidationTests
{
    [Theory]
    [InlineData(null, true)]
    [InlineData("", true)]
    [InlineData("a@b.co", true)]
    [InlineData("user.name+tag@espaciopro.pe", true)]
    [InlineData("not-an-email", false)]
    [InlineData("missing@tld", false)]
    public void IsValid_AcceptsAndRejectsExpected(string? email, bool expected)
    {
        EmailValidation.IsValid(email).Should().Be(expected);
    }
}
