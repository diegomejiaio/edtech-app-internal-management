using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// WhatsApp message belonging to a <see cref="WaConversation"/>. Container: <c>whatsapp</c>,
/// partition key: <c>/type</c> = "message". Per <c>docs/10-whatsapp-crm-mvp.md</c> §1.
/// </summary>
public sealed class WaMessage : BaseEntity
{
    public override string Type => EntityTypes.Message;

    /// <summary>GUID of the owning <see cref="WaConversation"/>.</summary>
    [JsonPropertyName("conversationId")]
    public string ConversationId { get; set; } = default!;

    /// <summary>Meta WhatsApp message id (wamid...), null for stub/locally-generated sends.</summary>
    [JsonPropertyName("waMessageId")]
    public string? WaMessageId { get; set; }

    [JsonPropertyName("sender")]
    public WaMessageSender Sender { get; set; }

    [JsonPropertyName("kind")]
    public WaMessageKind Kind { get; set; } = WaMessageKind.Text;

    [JsonPropertyName("text")]
    public string Text { get; set; } = default!;

    [JsonPropertyName("status")]
    public WaMessageStatus Status { get; set; } = WaMessageStatus.Sent;

    /// <summary>ISO 8601 timestamp the message was sent/received.</summary>
    [JsonPropertyName("ts")]
    public string Ts { get; set; } = DateTime.UtcNow.ToString("o");

    /// <summary>True when this agent message originated from an AI suggestion.</summary>
    [JsonPropertyName("aiSuggested")]
    public bool AiSuggested { get; set; }

    /// <summary>AI confidence (0..1) when <see cref="AiSuggested"/>, else null.</summary>
    [JsonPropertyName("confidence")]
    public double? Confidence { get; set; }
}
