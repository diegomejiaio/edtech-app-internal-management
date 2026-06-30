using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// WhatsApp conversation (inbox thread). Container: <c>whatsapp</c>, partition key: <c>/type</c> = "conversation".
/// Per <c>docs/10-whatsapp-crm-mvp.md</c> §1.
/// </summary>
public sealed class WaConversation : BaseEntity
{
    public override string Type => EntityTypes.Conversation;

    /// <summary>WhatsApp contact id (phone-derived). Used to dedup one active conversation per contact.</summary>
    [JsonPropertyName("waContactId")]
    public string WaContactId { get; set; } = default!;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = default!;

    [JsonPropertyName("phone")]
    public string Phone { get; set; } = default!;

    [JsonPropertyName("status")]
    public WaConversationStatus Status { get; set; } = WaConversationStatus.Open;

    /// <summary>Clerk user id of the assigned agent, or null when unassigned.</summary>
    [JsonPropertyName("assignedTo")]
    public string? AssignedTo { get; set; }

    [JsonPropertyName("aiMode")]
    public WaAiMode AiMode { get; set; } = WaAiMode.Off;

    [JsonPropertyName("leadState")]
    public WaLeadState LeadState { get; set; } = WaLeadState.New;

    /// <summary>ISO 8601 timestamp of the last inbound (customer) message.</summary>
    [JsonPropertyName("lastInboundAt")]
    public string? LastInboundAt { get; set; }

    /// <summary>ISO 8601 timestamp of the last message in either direction.</summary>
    [JsonPropertyName("lastMessageAt")]
    public string? LastMessageAt { get; set; }

    /// <summary>Truncated preview of the last message body.</summary>
    [JsonPropertyName("lastMessagePreview")]
    public string? LastMessagePreview { get; set; }

    [JsonPropertyName("unread")]
    public int Unread { get; set; }

    /// <summary>Tags applied to the conversation/lead (free-form).</summary>
    [JsonPropertyName("tags")]
    public string[]? Tags { get; set; }

    /// <summary>Program/course of interest, e.g. "drywall", "melamina". Free-form.</summary>
    [JsonPropertyName("program")]
    public string? Program { get; set; }

    /// <summary>ISO 8601 datetime of the scheduled in-person visit (when LeadState = Visit).</summary>
    [JsonPropertyName("visitAt")]
    public string? VisitAt { get; set; }

    /// <summary>
    /// Precomputed accent- and case-insensitive index (displayName + phone) used by
    /// paginated search. Set by the repository on every write; do not assign from API code.
    /// </summary>
    [JsonPropertyName("searchText")]
    public string? SearchText { get; set; }

    /// <inheritdoc />
    /// <remarks>One active conversation per <c>waContactId</c>.</remarks>
    [JsonPropertyName("dedupKey")]
    public override string DedupKey => $"conversation:{WaContactId}";
}
