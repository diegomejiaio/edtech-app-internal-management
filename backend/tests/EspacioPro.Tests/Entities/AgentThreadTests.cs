using System.Text.Json;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace EspacioPro.Tests.Entities;

/// <summary>
/// Invariants for the ephemeral <see cref="AgentThread"/> mapping (Telegram chat → Foundry thread).
/// The repository's read/upsert/delete paths talk to a live Cosmos <c>Container</c> and are covered
/// by integration checks against the deployed endpoint, not by this unit suite (consistent with the
/// other Cosmos repositories, none of which are unit-tested). These tests pin the contract the
/// repository and Cosmos rely on: the discriminator, the 7-day TTL value, and — most importantly —
/// the exact <c>ttl</c> wire name, since a wrong name silently disables Cosmos auto-expiry.
/// </summary>
public class AgentThreadTests
{
    [Fact]
    public void Type_DiscriminatorIsCanonical()
    {
        var t = new AgentThread();

        t.Type.Should().Be(EntityTypes.AgentThread);
        t.Type.Should().Be("agentThread");
    }

    [Fact]
    public void NewInstance_ActiveDefaultsTrue()
    {
        var t = new AgentThread();

        t.Active.Should().BeTrue("active=true is the default per BaseEntity");
        t.DeletedAt.Should().BeNull();
        t.DeletedBy.Should().BeNull();
    }

    [Fact]
    public void TtlSeconds_IsSevenDays()
    {
        AgentThread.TtlSeconds.Should().Be(604800);
        AgentThread.TtlSeconds.Should().Be(7 * 24 * 60 * 60);
    }

    [Fact]
    public void Serialize_EmitsCosmosTtlAndCamelCaseFields()
    {
        var thread = new AgentThread
        {
            Id = "123456",
            ChatId = 123456,
            ThreadId = "thread_abc",
            Ttl = AgentThread.TtlSeconds,
        };

        var json = JsonSerializer.Serialize(thread);

        // The Cosmos system property MUST be the lowercase "ttl" for per-item auto-expiry to work.
        json.Should().Contain("\"ttl\":604800");
        json.Should().Contain("\"chatId\":123456");
        json.Should().Contain("\"threadId\":\"thread_abc\"");
        json.Should().Contain("\"type\":\"agentThread\"");
        json.Should().Contain("\"id\":\"123456\"");
    }

    [Fact]
    public void Deserialize_RoundTripsCoreFields()
    {
        const string json =
            "{\"id\":\"999\",\"type\":\"agentThread\",\"chatId\":999,\"threadId\":\"thread_x\",\"ttl\":604800,\"active\":true}";

        var thread = JsonSerializer.Deserialize<AgentThread>(json);

        thread.Should().NotBeNull();
        thread!.ChatId.Should().Be(999);
        thread.ThreadId.Should().Be("thread_x");
        thread.Ttl.Should().Be(604800);
    }
}
