using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Entities;

public class StudentTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        var s = new Student();

        s.Type.Should().Be(EntityTypes.Student);
        s.Type.Should().Be("student");
    }

    [Fact]
    public void NewInstance_ActiveDefaultsTrue()
    {
        var s = new Student();

        s.Active.Should().BeTrue("active=true is the default per BaseEntity");
        s.DeletedAt.Should().BeNull();
        s.DeletedBy.Should().BeNull();
    }
}

public class TeacherTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        var t = new Teacher();

        t.Type.Should().Be(EntityTypes.Teacher);
        t.Type.Should().Be("teacher");
    }
}
