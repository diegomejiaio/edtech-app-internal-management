using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Teacher entity. Container: <c>master</c>, partition key: <c>/type</c> = "teacher".
/// Per <c>docs/01-domain-model.md</c> §3.3.
/// </summary>
public sealed class Teacher : BaseEntity
{
    public override string Type => EntityTypes.Teacher;

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = default!;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = default!;

    [JsonPropertyName("docType")]
    public DocType DocType { get; set; }

    [JsonPropertyName("docNumber")]
    public string DocNumber { get; set; } = default!;

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("specialty")]
    public string? Specialty { get; set; }

    /// <summary>Populated post-MVP for teacher login. Null in v1.</summary>
    [JsonPropertyName("clerkUserId")]
    public string? ClerkUserId { get; set; }

    /// <inheritdoc />
    /// <remarks>One active <see cref="Teacher"/> per <c>(docType, docNumber)</c> pair.</remarks>
    [JsonPropertyName("dedupKey")]
    public override string DedupKey => $"{EnumToWire(DocType)}:{DocNumber}";
}
