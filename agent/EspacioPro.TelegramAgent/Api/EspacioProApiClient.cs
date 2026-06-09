using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Api;

/// <summary>
/// Read-only client over the existing Espacio Pro REST API.
/// The agent NEVER writes Cosmos directly — every read/write goes through this API
/// so validation, audit and soft-delete rules are preserved. The PoC only reads schedules.
/// </summary>
public sealed class EspacioProApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<EspacioProApiClient> _logger;
    private readonly string _baseUrl;
    private readonly string? _agentKey;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public EspacioProApiClient(HttpClient http, IConfiguration config, ILogger<EspacioProApiClient> logger)
    {
        _http = http;
        _logger = logger;
        _baseUrl = (config["ESPACIOPRO_API_URL"] ?? "http://localhost:7071").TrimEnd('/');
        _agentKey = config["AGENT_API_KEY"];
    }

    public async Task<IReadOnlyList<ScheduleSummary>> GetSchedulesAsync(int limit, CancellationToken ct)
    {
        var url = $"{_baseUrl}/api/v1/schedules?limit={limit}&status=active";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrEmpty(_agentKey))
                request.Headers.Add("X-Agent-Key", _agentKey);

            using var resp = await _http.SendAsync(request, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("GET schedules failed: {Status} {Url}", (int)resp.StatusCode, url);
                return Array.Empty<ScheduleSummary>();
            }

            var stream = await resp.Content.ReadAsStreamAsync(ct);
            var page = await JsonSerializer.DeserializeAsync<Paginated<ScheduleSummary>>(stream, JsonOptions, ct);
            return page?.Items ?? new List<ScheduleSummary>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling schedules endpoint.");
            return Array.Empty<ScheduleSummary>();
        }
    }

    public sealed class Paginated<T>
    {
        [JsonPropertyName("items")]
        public List<T> Items { get; set; } = new();

        [JsonPropertyName("total")]
        public int Total { get; set; }
    }

    public sealed class ScheduleSummary
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("course")]
        public string? Course { get; set; }

        [JsonPropertyName("level")]
        public string? Level { get; set; }

        [JsonPropertyName("teacherName")]
        public string? TeacherName { get; set; }

        [JsonPropertyName("weekdays")]
        public string? Weekdays { get; set; }

        [JsonPropertyName("startTime")]
        public string? StartTime { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("startDate")]
        public string? StartDate { get; set; }

        [JsonPropertyName("enrolledActiveCount")]
        public int EnrolledActiveCount { get; set; }

        [JsonPropertyName("capacity")]
        public int Capacity { get; set; }
    }
}
