using System.Text.Json.Serialization;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Common;

/// <summary>Response returned after updating an embedded schedule session.</summary>
public sealed record ScheduleSessionUpdateResponse
{
    [JsonPropertyName("session")]
    public ScheduleSession Session { get; init; } = default!;

    [JsonPropertyName("scheduleEtag")]
    public string? ScheduleETag { get; init; }
}

