using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// WhatsApp Business API configuration. Container: <c>whatsapp</c>, partition key: <c>/type</c> = "waConfig".
/// Per <c>docs/10-whatsapp-crm-mvp.md</c> §1. Secret tokens are never persisted to the repo —
/// <see cref="VerifyToken"/> is read from configuration at request time and not serialized to Cosmos.
/// </summary>
public sealed class WaConfig : BaseEntity
{
    public override string Type => EntityTypes.WaConfig;

    [JsonPropertyName("phoneNumberId")]
    public string? PhoneNumberId { get; set; }

    [JsonPropertyName("wabaId")]
    public string? WabaId { get; set; }

    /// <summary>Meta webhook verify token. Not persisted (secret) — sourced from app settings.</summary>
    [JsonIgnore]
    public string? VerifyToken { get; set; }
}
