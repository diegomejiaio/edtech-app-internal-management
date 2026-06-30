using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// WhatsApp lead. Container: <c>whatsapp</c>, partition key: <c>/type</c> = "lead".
/// Per <c>docs/10-whatsapp-crm-mvp.md</c> §1.
/// </summary>
public sealed class WaLead : BaseEntity
{
    public override string Type => EntityTypes.Lead;

    [JsonPropertyName("phone")]
    public string Phone { get; set; } = default!;

    [JsonPropertyName("state")]
    public WaLeadState State { get; set; } = WaLeadState.New;

    /// <inheritdoc />
    /// <remarks>One active lead per <c>phone</c>.</remarks>
    [JsonPropertyName("dedupKey")]
    public override string DedupKey => $"lead:{Phone}";
}
