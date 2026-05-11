using System.Text.Json.Serialization;

namespace EspacioPro.Domain.Common;

/// <summary>
/// Base class for all Cosmos DB documents.
/// Audit fields are auto-populated by repositories — domain code must not write them.
/// </summary>
public abstract class BaseEntity
{
    /// <summary>GUID identifier generated in backend.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("D");

    /// <summary>Discriminator and Cosmos partition key (/type).</summary>
    [JsonPropertyName("type")]
    public abstract string Type { get; }

    /// <summary>Soft delete flag. False means logically deleted.</summary>
    [JsonPropertyName("active")]
    public bool Active { get; set; } = true;

    /// <summary>ISO 8601 UTC timestamp set on insert.</summary>
    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    /// <summary>Snapshot of the user who created this document.</summary>
    [JsonPropertyName("createdBy")]
    public AuditUser? CreatedBy { get; set; }

    /// <summary>ISO 8601 UTC timestamp set on every update.</summary>
    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    /// <summary>Snapshot of the user who last updated this document.</summary>
    [JsonPropertyName("updatedBy")]
    public AuditUser? UpdatedBy { get; set; }

    /// <summary>ISO 8601 UTC timestamp set when Active flips to false.</summary>
    [JsonPropertyName("deletedAt")]
    public string? DeletedAt { get; set; }

    /// <summary>Snapshot of the user who soft-deleted this document.</summary>
    [JsonPropertyName("deletedBy")]
    public AuditUser? DeletedBy { get; set; }

    /// <summary>
    /// Cosmos DB optimistic concurrency token.
    /// Not serialized to the document body — populated from <c>ItemResponse.ETag</c> by repositories.
    /// </summary>
    [JsonIgnore]
    public string? ETag { get; set; }

    /// <summary>
    /// Value for the <c>master</c> container's unique-key constraint on <c>/dedupKey</c>.
    /// Default uses <see cref="Id"/> so each document is trivially unique;
    /// entities with a natural business key (e.g. <c>code</c>, <c>docType:docNumber</c>) override this.
    /// Get-only: derived on every serialize, ignored on deserialize.
    /// </summary>
    [JsonPropertyName("dedupKey")]
    public virtual string DedupKey => Id;

    /// <summary>
    /// Serializes an enum value to camelCase wire format, matching the global
    /// <c>JsonStringEnumConverter(JsonNamingPolicy.CamelCase)</c> behavior.
    /// Used by entities that derive <see cref="DedupKey"/> from enum-typed fields.
    /// </summary>
    protected static string EnumToWire<TEnum>(TEnum value) where TEnum : struct, Enum
    {
        var s = value.ToString();
        return string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
    }
}
