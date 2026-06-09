using System.Globalization;
using System.Text.Json;
using EspacioPro.TelegramAgent.Api;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Agent.Foundry;

/// <summary>
/// Executes a single function tool call emitted by the Foundry agent against the
/// Espacio Pro REST API and returns a JSON string the model can read back. All writes
/// go through <see cref="EspacioProApiClient"/>, preserving validation, audit and
/// soft-delete rules. Validation failures are surfaced verbatim so the agent can
/// explain them to the user.
/// </summary>
public sealed class AgentToolDispatcher
{
    private const int DefaultLimit = 20;

    private readonly EspacioProApiClient _api;
    private readonly ILogger<AgentToolDispatcher> _logger;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public AgentToolDispatcher(EspacioProApiClient api, ILogger<AgentToolDispatcher> logger)
    {
        _api = api;
        _logger = logger;
    }

    /// <summary>Dispatches one tool call. <paramref name="argumentsJson"/> is the raw arguments object.</summary>
    public async Task<string> ExecuteAsync(string name, string argumentsJson, CancellationToken ct)
    {
        try
        {
            using var doc = ParseArguments(argumentsJson);
            var args = doc.RootElement;

            return name switch
            {
                AgentToolset.GetCatalog => await GetCatalogAsync(args, ct),
                AgentToolset.QuerySchedules => await QuerySchedulesAsync(ct),
                AgentToolset.QuerySessions => await QuerySessionsAsync(args, ct),
                AgentToolset.ListTeachers => await ListTeachersAsync(args, ct),
                AgentToolset.ListStudents => await ListStudentsAsync(args, ct),
                AgentToolset.FindEnrollments => await FindEnrollmentsAsync(args, ct),
                AgentToolset.CreateSchedule => await CreateScheduleAsync(args, ct),
                AgentToolset.CreateStudent => await CreateStudentAsync(args, ct),
                AgentToolset.CreateEnrollment => await CreateEnrollmentAsync(args, ct),
                AgentToolset.RegisterStudentPayment => await RegisterStudentPaymentAsync(args, ct),
                _ => Error($"Unknown tool '{name}'."),
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tool '{Tool}' failed.", name);
            return Error($"Tool '{name}' raised an error: {ex.Message}");
        }
    }

    private async Task<string> GetCatalogAsync(JsonElement args, CancellationToken ct)
    {
        var code = GetString(args, "code");
        if (string.IsNullOrWhiteSpace(code))
            return Error("Missing required argument 'code'.");

        var values = await _api.GetCatalogValuesAsync(code, ct);
        return Ok(new { code, values });
    }

    private async Task<string> QuerySchedulesAsync(CancellationToken ct)
    {
        var schedules = await _api.GetSchedulesAsync(DefaultLimit, ct);
        return Ok(new { count = schedules.Count, schedules });
    }

    private async Task<string> QuerySessionsAsync(JsonElement args, CancellationToken ct)
    {
        var date = GetString(args, "date");
        var sessions = await _api.GetSessionsByDateAsync(date, ct);
        return Ok(new { date, count = sessions.Count, sessions });
    }

    private async Task<string> ListTeachersAsync(JsonElement args, CancellationToken ct)
    {
        var teachers = await _api.GetTeachersAsync(GetString(args, "search"), DefaultLimit, ct);
        return Ok(new { count = teachers.Count, teachers });
    }

    private async Task<string> ListStudentsAsync(JsonElement args, CancellationToken ct)
    {
        var students = await _api.GetStudentsAsync(GetString(args, "search"), DefaultLimit, ct);
        return Ok(new { count = students.Count, students });
    }

    private async Task<string> FindEnrollmentsAsync(JsonElement args, CancellationToken ct)
    {
        var enrollments = await _api.FindEnrollmentsAsync(
            GetString(args, "studentId"),
            GetString(args, "scheduleId"),
            status: "active",
            DefaultLimit,
            ct);
        return Ok(new { count = enrollments.Count, enrollments });
    }

    private async Task<string> CreateScheduleAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateScheduleRequest(
            Course: GetString(args, "course") ?? string.Empty,
            Level: GetString(args, "level"),
            TeacherId: GetString(args, "teacherId") ?? string.Empty,
            Weekdays: GetString(args, "weekdays") ?? string.Empty,
            StartTime: GetString(args, "startTime") ?? string.Empty,
            EndTime: GetString(args, "endTime") ?? string.Empty,
            Price: GetDecimal(args, "price"),
            Capacity: GetInt(args, "capacity"),
            Status: "active",
            StartDate: GetString(args, "startDate") ?? string.Empty);

        var result = await _api.CreateScheduleAsync(request, ct);
        return FromApiResult(result);
    }

    private async Task<string> CreateStudentAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateStudentRequest(
            FirstName: GetString(args, "firstName") ?? string.Empty,
            LastName: GetString(args, "lastName") ?? string.Empty,
            DocType: GetString(args, "docType") ?? "dni",
            DocNumber: GetString(args, "docNumber") ?? string.Empty,
            Phone: GetString(args, "phone"),
            Email: GetString(args, "email"),
            Source: GetString(args, "source"),
            Notes: GetString(args, "notes"));

        var result = await _api.CreateStudentAsync(request, ct);
        return FromApiResult(result);
    }

    private async Task<string> CreateEnrollmentAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateEnrollmentRequest(
            StudentId: GetString(args, "studentId") ?? string.Empty,
            ScheduleId: GetString(args, "scheduleId") ?? string.Empty,
            EnrollmentDate: GetString(args, "enrollmentDate") ?? string.Empty,
            Status: "active");

        var result = await _api.CreateEnrollmentAsync(request, ct);
        return FromApiResult(result);
    }

    private async Task<string> RegisterStudentPaymentAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateStudentPaymentRequest(
            EnrollmentId: GetString(args, "enrollmentId") ?? string.Empty,
            Date: GetString(args, "date") ?? string.Empty,
            Amount: GetDecimal(args, "amount"),
            InstallmentNumber: GetInt(args, "installmentNumber"),
            PaymentMethod: GetString(args, "paymentMethod") ?? string.Empty,
            HasReceipt: GetBool(args, "hasReceipt"),
            ReceiptNumber: GetString(args, "receiptNumber"),
            Notes: GetString(args, "notes"));

        var result = await _api.CreateStudentPaymentAsync(request, ct);
        return FromApiResult(result);
    }

    // --------------------------------------------------------------- helpers

    private static JsonDocument ParseArguments(string? argumentsJson)
    {
        if (string.IsNullOrWhiteSpace(argumentsJson))
            return JsonDocument.Parse("{}");
        return JsonDocument.Parse(argumentsJson);
    }

    private static string FromApiResult(EspacioProApiClient.ApiResult result)
    {
        if (result.Success)
            return Ok(new { success = true, created = AsRaw(result.Body) });
        return Ok(new { success = false, status = result.StatusCode, error = AsRaw(result.Body) });
    }

    /// <summary>Embeds an API JSON body as a structured value when possible, else as a string.</summary>
    private static object AsRaw(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return string.Empty;
        try
        {
            return JsonSerializer.Deserialize<JsonElement>(body);
        }
        catch (JsonException)
        {
            return body;
        }
    }

    private static string? GetString(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return null;
        return v.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.String => v.GetString(),
            _ => v.ToString(),
        };
    }

    private static decimal GetDecimal(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return 0m;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetDecimal(),
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => d,
            _ => 0m,
        };
    }

    private static int GetInt(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return 0;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetInt32(),
            JsonValueKind.String when int.TryParse(v.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) => i,
            _ => 0,
        };
    }

    private static bool GetBool(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return false;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(v.GetString(), out var b) => b,
            _ => false,
        };
    }

    private static string Ok(object value) => JsonSerializer.Serialize(value, Json);

    private static string Error(string message) => JsonSerializer.Serialize(new { error = message }, Json);
}
