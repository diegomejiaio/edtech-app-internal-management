using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Api;

/// <summary>
/// Client over the existing Espacio Pro REST API. The agent NEVER writes Cosmos
/// directly — every read and write goes through this API so validation, audit and
/// soft-delete rules are preserved. Service auth uses the <c>X-Agent-Key</c> header,
/// which the backend accepts as an admin-role bypass for machine callers.
/// </summary>
public sealed class EspacioProApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<EspacioProApiClient> _logger;
    private readonly string _baseUrl;
    private readonly string? _agentKey;

    private static readonly JsonSerializerOptions ReadOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public EspacioProApiClient(HttpClient http, IConfiguration config, ILogger<EspacioProApiClient> logger)
    {
        _http = http;
        _logger = logger;
        _baseUrl = (config["ESPACIOPRO_API_URL"] ?? "http://localhost:7071").TrimEnd('/');
        _agentKey = config["AGENT_API_KEY"];
    }

    // ----------------------------------------------------------------- reads

    /// <summary>GET /api/v1/schedules — active schedules, newest first.</summary>
    public async Task<IReadOnlyList<ScheduleSummary>> GetSchedulesAsync(int limit, CancellationToken ct)
    {
        var page = await GetAsync<Paginated<ScheduleSummary>>(
            $"/api/v1/schedules?limit={limit}&status=active", ct);
        return page?.Items ?? new List<ScheduleSummary>();
    }

    /// <summary>GET /api/v1/teachers — optional free-text search by name/specialty.</summary>
    public async Task<IReadOnlyList<TeacherSummary>> GetTeachersAsync(string? search, int limit, CancellationToken ct)
    {
        var url = $"/api/v1/teachers?limit={limit}";
        if (!string.IsNullOrWhiteSpace(search))
            url += $"&search={Uri.EscapeDataString(search)}";
        var page = await GetAsync<Paginated<TeacherSummary>>(url, ct);
        return page?.Items ?? new List<TeacherSummary>();
    }

    /// <summary>GET /api/v1/students — optional free-text search by name/document.</summary>
    public async Task<IReadOnlyList<StudentSummary>> GetStudentsAsync(string? search, int limit, CancellationToken ct)
    {
        var url = $"/api/v1/students?limit={limit}";
        if (!string.IsNullOrWhiteSpace(search))
            url += $"&search={Uri.EscapeDataString(search)}";
        var page = await GetAsync<Paginated<StudentSummary>>(url, ct);
        return page?.Items ?? new List<StudentSummary>();
    }

    /// <summary>
    /// GET /api/v1/sessions?date=YYYY-MM-DD — class sessions on a date across active schedules,
    /// flattened with parent-schedule context. When <paramref name="date"/> is null the backend
    /// defaults to today (America/Lima). Used to answer "clases de hoy".
    /// </summary>
    public async Task<IReadOnlyList<SessionSummary>> GetSessionsByDateAsync(string? date, CancellationToken ct)
    {
        var url = "/api/v1/sessions";
        if (!string.IsNullOrWhiteSpace(date))
            url += $"?date={Uri.EscapeDataString(date)}";
        var page = await GetAsync<SessionListResponse>(url, ct);
        return page?.Items ?? new List<SessionSummary>();
    }

    /// <summary>
    /// GET /api/v1/enrollments — filter by student and/or schedule. Defaults to active
    /// enrollments, which is what payment registration needs to resolve an enrollmentId.
    /// </summary>
    public async Task<IReadOnlyList<EnrollmentSummary>> FindEnrollmentsAsync(
        string? studentId, string? scheduleId, string status, int limit, CancellationToken ct)
    {
        var url = $"/api/v1/enrollments?limit={limit}";
        if (!string.IsNullOrWhiteSpace(studentId))
            url += $"&studentId={Uri.EscapeDataString(studentId)}";
        if (!string.IsNullOrWhiteSpace(scheduleId))
            url += $"&scheduleId={Uri.EscapeDataString(scheduleId)}";
        if (!string.IsNullOrWhiteSpace(status))
            url += $"&status={Uri.EscapeDataString(status)}";
        var page = await GetAsync<Paginated<EnrollmentSummary>>(url, ct);
        return page?.Items ?? new List<EnrollmentSummary>();
    }

    /// <summary>GET /api/v1/catalogs/{code} — returns the active values of a catalog
    /// (e.g. "courses", "levels", "weekdays", "paymentMethods"). Used so the agent
    /// always proposes valid values without hardcoding them.</summary>
    public async Task<IReadOnlyList<string>> GetCatalogValuesAsync(string code, CancellationToken ct)
    {
        var catalog = await GetAsync<Catalog>($"/api/v1/catalogs/{Uri.EscapeDataString(code)}", ct);
        if (catalog?.Items is null)
            return Array.Empty<string>();
        return catalog.Items
            .Where(i => i.Active)
            .OrderBy(i => i.Order)
            .Select(i => i.Value)
            .ToList();
    }

    // ---------------------------------------------------------------- writes

    /// <summary>POST /api/v1/schedules. Sessions are auto-generated server-side.</summary>
    public Task<ApiResult> CreateScheduleAsync(CreateScheduleRequest request, CancellationToken ct)
        => PostJsonAsync("/api/v1/schedules", request, ct);

    /// <summary>POST /api/v1/student-payments. EnrollmentId must be an active enrollment.</summary>
    public Task<ApiResult> CreateStudentPaymentAsync(CreateStudentPaymentRequest request, CancellationToken ct)
        => PostJsonAsync("/api/v1/student-payments", request, ct);

    /// <summary>POST /api/v1/students. 409 if a student with the same (docType, docNumber) is active.</summary>
    public Task<ApiResult> CreateStudentAsync(CreateStudentRequest request, CancellationToken ct)
        => PostJsonAsync("/api/v1/students", request, ct);

    /// <summary>POST /api/v1/enrollments. Enrolls a student into a schedule (validates capacity).</summary>
    public Task<ApiResult> CreateEnrollmentAsync(CreateEnrollmentRequest request, CancellationToken ct)
        => PostJsonAsync("/api/v1/enrollments", request, ct);

    // --------------------------------------------------------------- helpers

    private async Task<T?> GetAsync<T>(string path, CancellationToken ct)
    {
        var url = $"{_baseUrl}{path}";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            AddAgentKey(request);

            using var resp = await _http.SendAsync(request, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("GET {Path} failed: {Status}", path, (int)resp.StatusCode);
                return default;
            }

            var stream = await resp.Content.ReadAsStreamAsync(ct);
            return await JsonSerializer.DeserializeAsync<T>(stream, ReadOptions, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling GET {Path}.", path);
            return default;
        }
    }

    private async Task<ApiResult> PostJsonAsync<TBody>(string path, TBody body, CancellationToken ct)
    {
        var url = $"{_baseUrl}{path}";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            AddAgentKey(request);
            var json = JsonSerializer.Serialize(body, WriteOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            using var resp = await _http.SendAsync(request, ct);
            var payload = await resp.Content.ReadAsStringAsync(ct);

            if (resp.IsSuccessStatusCode)
                return ApiResult.Ok(payload);

            _logger.LogWarning("POST {Path} failed: {Status} {Body}", path, (int)resp.StatusCode, payload);
            return ApiResult.Fail((int)resp.StatusCode, payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling POST {Path}.", path);
            return ApiResult.Fail((int)HttpStatusCode.ServiceUnavailable, ex.Message);
        }
    }

    private void AddAgentKey(HttpRequestMessage request)
    {
        if (!string.IsNullOrEmpty(_agentKey))
            request.Headers.Add("X-Agent-Key", _agentKey);
    }

    // ------------------------------------------------------------------ DTOs

    /// <summary>Outcome of a write call, preserving the API response body (success or ProblemDetails).</summary>
    public sealed record ApiResult(bool Success, int StatusCode, string Body)
    {
        public static ApiResult Ok(string body) => new(true, 200, body);
        public static ApiResult Fail(int status, string body) => new(false, status, body);
    }

    public sealed class Paginated<T>
    {
        [JsonPropertyName("items")]
        public List<T> Items { get; set; } = new();

        [JsonPropertyName("total")]
        public int Total { get; set; }
    }

    private sealed class Catalog
    {
        [JsonPropertyName("code")]
        public string Code { get; set; } = string.Empty;

        [JsonPropertyName("items")]
        public List<CatalogItem> Items { get; set; } = new();
    }

    private sealed class CatalogItem
    {
        [JsonPropertyName("value")]
        public string Value { get; set; } = string.Empty;

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("active")]
        public bool Active { get; set; } = true;
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

    public sealed class TeacherSummary
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("firstName")]
        public string? FirstName { get; set; }

        [JsonPropertyName("lastName")]
        public string? LastName { get; set; }

        [JsonPropertyName("specialty")]
        public string? Specialty { get; set; }
    }

    public sealed class StudentSummary
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("firstName")]
        public string? FirstName { get; set; }

        [JsonPropertyName("lastName")]
        public string? LastName { get; set; }

        [JsonPropertyName("docNumber")]
        public string? DocNumber { get; set; }
    }

    /// <summary>Wrapper for GET /api/v1/sessions ({ date, count, items }).</summary>
    public sealed class SessionListResponse
    {
        [JsonPropertyName("date")]
        public string? Date { get; set; }

        [JsonPropertyName("count")]
        public int Count { get; set; }

        [JsonPropertyName("items")]
        public List<SessionSummary> Items { get; set; } = new();
    }

    public sealed class SessionSummary
    {
        [JsonPropertyName("scheduleId")]
        public string? ScheduleId { get; set; }

        [JsonPropertyName("scheduleCode")]
        public string? ScheduleCode { get; set; }

        [JsonPropertyName("course")]
        public string? Course { get; set; }

        [JsonPropertyName("level")]
        public string? Level { get; set; }

        [JsonPropertyName("teacherName")]
        public string? TeacherName { get; set; }

        [JsonPropertyName("weekdays")]
        public string? Weekdays { get; set; }

        [JsonPropertyName("sequenceNumber")]
        public int SequenceNumber { get; set; }

        [JsonPropertyName("date")]
        public string? Date { get; set; }

        [JsonPropertyName("startTime")]
        public string? StartTime { get; set; }

        [JsonPropertyName("endTime")]
        public string? EndTime { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }
    }

    public sealed class EnrollmentSummary
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("studentId")]
        public string? StudentId { get; set; }

        [JsonPropertyName("studentName")]
        public string? StudentName { get; set; }

        [JsonPropertyName("scheduleId")]
        public string? ScheduleId { get; set; }

        [JsonPropertyName("scheduleName")]
        public string? ScheduleName { get; set; }

        [JsonPropertyName("schedulePrice")]
        public decimal SchedulePrice { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }
    }

    /// <summary>
    /// Mirrors the backend ScheduleWriteRequest. Time fields are "HH:mm:ss" and
    /// startDate is "yyyy-MM-dd"; status/weekdays use the backend's camelCase enums.
    /// </summary>
    public sealed record CreateScheduleRequest(
        string Course,
        string? Level,
        string TeacherId,
        string Weekdays,
        string StartTime,
        string EndTime,
        decimal Price,
        int Capacity,
        string Status,
        string StartDate);

    /// <summary>Mirrors the backend StudentPaymentWriteRequest.</summary>
    public sealed record CreateStudentPaymentRequest(
        string EnrollmentId,
        string Date,
        decimal Amount,
        int InstallmentNumber,
        string PaymentMethod,
        bool HasReceipt,
        string? ReceiptNumber,
        string? Notes);

    /// <summary>
    /// Mirrors the backend StudentWriteRequest. <see cref="DocType"/> is a camelCase enum
    /// string ("dni" | "ce" | "passport"). Null optional fields are omitted on the wire.
    /// </summary>
    public sealed record CreateStudentRequest(
        string FirstName,
        string LastName,
        string DocType,
        string DocNumber,
        string? Phone,
        string? Email,
        string? Source,
        string? Notes);

    /// <summary>
    /// Mirrors the backend EnrollmentWriteRequest. <see cref="EnrollmentDate"/> is "yyyy-MM-dd"
    /// and <see cref="Status"/> a camelCase enum string ("active" | "completed" | "cancelled" | "pending").
    /// </summary>
    public sealed record CreateEnrollmentRequest(
        string StudentId,
        string ScheduleId,
        string EnrollmentDate,
        string Status);
}
