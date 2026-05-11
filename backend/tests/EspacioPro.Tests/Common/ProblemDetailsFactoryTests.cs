using EspacioPro.Application.Common;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Common;

public class ProblemDetailsFactoryTests
{
    [Fact]
    public void NotFound_UsesCanonicalUrnAndCorrelationId()
    {
        var p = ProblemDetailsFactory.NotFound("Student '42' not found.", "/api/v1/students/42", "corr-1");

        p.Type.Should().Be(ProblemTypes.NotFound);
        p.Status.Should().Be(404);
        p.Detail.Should().Be("Student '42' not found.");
        p.Instance.Should().Be("/api/v1/students/42");
        p.CorrelationId.Should().Be("corr-1");
        p.Errors.Should().BeNull();
    }

    [Fact]
    public void Validation_PopulatesErrorsMap()
    {
        var p = ProblemDetailsFactory.Validation("docNumber", "DNI must be 8 digits.", "/api/v1/teachers", "corr-2");

        p.Type.Should().Be(ProblemTypes.Validation);
        p.Status.Should().Be(422);
        p.Errors.Should().NotBeNull();
        p.Errors!.Should().ContainKey("docNumber");
        p.Errors["docNumber"].Should().ContainSingle().Which.Should().Be("DNI must be 8 digits.");
        p.CorrelationId.Should().Be("corr-2");
    }

    [Fact]
    public void Duplicate_UsesDuplicateUrnButConflictStatus()
    {
        var p = ProblemDetailsFactory.Duplicate("Already exists.");

        p.Type.Should().Be(ProblemTypes.Duplicate);
        p.Status.Should().Be(409);
    }
}
