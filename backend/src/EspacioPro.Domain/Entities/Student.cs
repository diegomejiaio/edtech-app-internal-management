using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Student entity. Container: <c>master</c>, partition key: <c>/type</c> = "student".
/// Per <c>docs/01-domain-model.md</c> §3.2.
/// </summary>
public sealed class Student : BaseEntity
{
    public override string Type => EntityTypes.Student;

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

    /// <summary>Free-form catalog reference to <c>studentSources</c> (see §3.1). Stored verbatim.</summary>
    [JsonPropertyName("source")]
    public string? Source { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    /// <inheritdoc />
    /// <remarks>One active <see cref="Student"/> per <c>(docType, docNumber)</c> pair.</remarks>
    [JsonPropertyName("dedupKey")]
    public override string DedupKey => $"{EnumToWire(DocType)}:{DocNumber}";
}
