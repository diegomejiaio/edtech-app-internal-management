using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Entities;

public class StudentPaymentTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        new StudentPayment().Type.Should().Be(EntityTypes.StudentPayment).And.Be("studentPayment");
    }
}

public class TeacherPaymentTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        new TeacherPayment().Type.Should().Be(EntityTypes.TeacherPayment).And.Be("teacherPayment");
    }
}

public class ExpenseTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        new Expense().Type.Should().Be(EntityTypes.Expense).And.Be("expense");
    }
}

public class EnumWireTests
{
    [Theory]
    [InlineData("Active", "active")]
    [InlineData("InProgress", "inProgress")]
    [InlineData("active", "active")]
    [InlineData("", "")]
    public void ToCamel_String_LowercasesFirstChar(string input, string expected)
    {
        EnumWire.ToCamel(input).Should().Be(expected);
    }

    [Fact]
    public void ToCamel_Generic_MatchesJsonStringEnumConverterCamelCase()
    {
        EnumWire.ToCamel(EnrollmentStatus.Active).Should().Be("active");
        EnumWire.ToCamel(EnrollmentStatus.Pending).Should().Be("pending");
        EnumWire.ToCamel(ScheduleStatus.InProgress).Should().Be("inProgress");
        EnumWire.ToCamel(ScheduleStatus.Cancelled).Should().Be("cancelled");
        EnumWire.ToCamel(DocType.Passport).Should().Be("passport");
    }
}

public class CorrelationIdsSanitizeTests
{
    [Theory]
    [InlineData("abc-123_DEF.xyz", "abc-123_DEF.xyz")]
    [InlineData("c0ffeeee-1234-5678-9abc-def012345678", "c0ffeeee-1234-5678-9abc-def012345678")]
    public void Sanitize_ValidHeader_ReturnsAsIs(string input, string expected)
    {
        CorrelationIds.Sanitize(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("contains space")]
    [InlineData("contains/slash")]
    [InlineData("contains\nnewline")]
    [InlineData("contains;injection")]
    public void Sanitize_InvalidHeader_ReturnsNull(string? input)
    {
        CorrelationIds.Sanitize(input).Should().BeNull();
    }

    [Fact]
    public void Sanitize_TooLong_ReturnsNull()
    {
        var tooLong = new string('a', CorrelationIds.MaxLength + 1);
        CorrelationIds.Sanitize(tooLong).Should().BeNull();
    }

    [Fact]
    public void Sanitize_ExactlyMaxLength_Allowed()
    {
        var atLimit = new string('a', CorrelationIds.MaxLength);
        CorrelationIds.Sanitize(atLimit).Should().Be(atLimit);
    }
}
