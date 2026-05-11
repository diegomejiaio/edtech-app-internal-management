using System.Text.Json.Serialization;

namespace EspacioPro.Application.Common;

/// <summary>
/// RFC 7807 Problem Details body, plus Espacio Pro extensions:
/// - <c>correlationId</c>: x-correlation-id of the request (cheatsheet §6).
/// - <c>errors</c>: ASP.NET-style field map for 422 (cheatsheet §6.2).
/// Serialized as <c>application/problem+json</c>.
/// </summary>
public sealed class ProblemDetailsResponse
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = default!;

    [JsonPropertyName("title")]
    public string Title { get; init; } = default!;

    [JsonPropertyName("status")]
    public int Status { get; init; }

    [JsonPropertyName("detail")]
    public string Detail { get; init; } = default!;

    [JsonPropertyName("instance")]
    public string? Instance { get; init; }

    [JsonPropertyName("correlationId")]
    public string? CorrelationId { get; init; }

    [JsonPropertyName("errors")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IDictionary<string, string[]>? Errors { get; init; }
}
