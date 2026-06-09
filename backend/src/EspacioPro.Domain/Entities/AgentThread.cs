using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Ephemeral mapping between a Telegram chat and its Foundry conversation thread,
/// stored in the <c>operations</c> container so the agent's session survives worker
/// restarts (the in-memory cache is volatile on Flex Consumption).
/// </summary>
/// <remarks>
/// Unlike business entities this document is intentionally ephemeral:
/// <list type="bullet">
/// <item><description><c>id</c> equals the Telegram <c>chatId</c> so it can be point-read by key.</description></item>
/// <item><description>It carries a native Cosmos <c>ttl</c> (seconds) so idle mappings auto-expire
/// (the <c>operations</c> container has <c>defaultTtl: -1</c>, enabling per-item TTL).</description></item>
/// <item><description>It is hard-deleted on <c>/nuevo</c> rather than soft-deleted, since it holds no
/// audit value once the conversation is reset.</description></item>
/// </list>
/// </remarks>
public sealed class AgentThread : BaseEntity
{
    /// <summary>Time-to-live applied to idle thread mappings: 7 days in seconds.</summary>
    public const int TtlSeconds = 7 * 24 * 60 * 60;

    public override string Type => EntityTypes.AgentThread;

    /// <summary>Telegram chat identifier the thread belongs to.</summary>
    [JsonPropertyName("chatId")]
    public long ChatId { get; set; }

    /// <summary>Foundry persistent-agent thread identifier.</summary>
    [JsonPropertyName("threadId")]
    public string ThreadId { get; set; } = string.Empty;

    /// <summary>
    /// Native Cosmos time-to-live in seconds. When set, Cosmos auto-deletes the document
    /// after the interval elapses without an update (sliding window on every upsert).
    /// </summary>
    [JsonPropertyName("ttl")]
    public int? Ttl { get; set; }
}
