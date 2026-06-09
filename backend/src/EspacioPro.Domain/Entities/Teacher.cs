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

    /// <summary>
    /// Short, human-friendly unique identifier (e.g. <c>PRO-7Q3K9</c>), generated on create.
    /// Distinct from the GUID <see cref="BaseEntity.Id"/>. Crockford Base32 (see <c>ShortCodeGenerator</c>).
    /// </summary>
    [JsonPropertyName("code")]
    public string? Code { get; set; }

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

    /// <summary>
    /// Precomputed accent- and case-insensitive index used by paginated search
    /// (<see cref="TextNormalizer.Normalize"/>). Set by the repository on every
    /// write; do not assign from domain or API code.
    /// </summary>
    [JsonPropertyName("searchText")]
    public string? SearchText { get; set; }

    /// <inheritdoc />
    /// <remarks>One active <see cref="Teacher"/> per <c>(docType, docNumber)</c> pair.</remarks>
    [JsonPropertyName("dedupKey")]
    public override string DedupKey => $"{EnumToWire(DocType)}:{DocNumber}";
}
