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
                AgentToolset.QuerySchedulePayments => await QuerySchedulePaymentsAsync(args, ct),
                AgentToolset.CreateSchedule => await CreateScheduleAsync(args, ct),
                AgentToolset.CreateStudent => await CreateStudentAsync(args, ct),
                AgentToolset.CreateEnrollment => await CreateEnrollmentAsync(args, ct),
                AgentToolset.RegisterStudentPayment => await RegisterStudentPaymentAsync(args, ct),
                AgentToolset.GetTeacher => await GetTeacherAsync(args, ct),
                AgentToolset.CreateTeacher => await CreateTeacherAsync(args, ct),
                AgentToolset.UpdateTeacher => await UpdateTeacherAsync(args, ct),
                AgentToolset.UpdateStudent => await UpdateStudentAsync(args, ct),
                AgentToolset.UpdateSchedule => await UpdateScheduleAsync(args, ct),
                AgentToolset.UpdateEnrollment => await UpdateEnrollmentAsync(args, ct),
                AgentToolset.QueryScheduleDashboard => await QueryScheduleDashboardAsync(args, ct),
                AgentToolset.ListStudentPayments => await ListStudentPaymentsAsync(args, ct),
                AgentToolset.UpdateStudentPayment => await UpdateStudentPaymentAsync(args, ct),
                AgentToolset.CreateTeacherPayment => await CreateTeacherPaymentAsync(args, ct),
                AgentToolset.ListTeacherPayments => await ListTeacherPaymentsAsync(args, ct),
                AgentToolset.CreateExpense => await CreateExpenseAsync(args, ct),
                AgentToolset.ListExpenses => await ListExpensesAsync(args, ct),
                AgentToolset.QueryDebtors => await QueryDebtorsAsync(args, ct),
                AgentToolset.AddCatalogItem => await AddCatalogItemAsync(args, ct),
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

    private async Task<string> QuerySchedulePaymentsAsync(JsonElement args, CancellationToken ct)
    {
        var scheduleId = GetString(args, "scheduleId");
        if (string.IsNullOrWhiteSpace(scheduleId))
            return Error("Missing required argument 'scheduleId'.");

        var rows = await _api.GetSchedulePaymentStatusAsync(
            scheduleId, GetString(args, "status") ?? "active", DefaultLimit, ct);
        return Ok(new { scheduleId, count = rows.Count, enrollments = rows });
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

    // ------------------------------------------------------ teachers (write)

    private async Task<string> GetTeacherAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var body = await _api.GetRawAsync($"/api/v1/teachers/{Uri.EscapeDataString(id)}", ct);
        return body is null
            ? Error($"Teacher '{id}' not found.")
            : Ok(new { teacher = AsRaw(body) });
    }

    private async Task<string> CreateTeacherAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateTeacherRequest(
            FirstName: GetString(args, "firstName") ?? string.Empty,
            LastName: GetString(args, "lastName") ?? string.Empty,
            DocType: GetString(args, "docType") ?? "dni",
            DocNumber: GetString(args, "docNumber") ?? string.Empty,
            Phone: GetString(args, "phone"),
            Email: GetString(args, "email"),
            Specialty: GetString(args, "specialty"));

        var result = await _api.CreateTeacherAsync(request, ct);
        return FromApiResult(result);
    }

    private static readonly string[] TeacherUpdatableFields =
        ["firstName", "lastName", "docType", "docNumber", "phone", "email", "specialty", "active"];

    private async Task<string> UpdateTeacherAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var result = await _api.UpdateEntityAsync(
            $"/api/v1/teachers/{Uri.EscapeDataString(id)}", args, TeacherUpdatableFields, ct);
        return FromApiResult(result);
    }

    // ------------------------------------------------------ students (write)

    private static readonly string[] StudentUpdatableFields =
        ["firstName", "lastName", "docType", "docNumber", "phone", "email", "source", "notes", "active"];

    private async Task<string> UpdateStudentAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var result = await _api.UpdateEntityAsync(
            $"/api/v1/students/{Uri.EscapeDataString(id)}", args, StudentUpdatableFields, ct);
        return FromApiResult(result);
    }

    // ------------------------------------------------ schedules (write/read)

    private static readonly string[] ScheduleUpdatableFields =
        ["course", "level", "teacherId", "weekdays", "startTime", "endTime", "price", "capacity", "status", "startDate"];

    private async Task<string> UpdateScheduleAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var result = await _api.UpdateEntityAsync(
            $"/api/v1/schedules/{Uri.EscapeDataString(id)}", args, ScheduleUpdatableFields, ct);
        return FromApiResult(result);
    }

    private async Task<string> QueryScheduleDashboardAsync(JsonElement args, CancellationToken ct)
    {
        var scheduleId = GetString(args, "scheduleId");
        if (string.IsNullOrWhiteSpace(scheduleId))
            return Error("Missing required argument 'scheduleId'.");

        var path = $"/api/v1/schedules/{Uri.EscapeDataString(scheduleId)}/dashboard";
        var month = GetString(args, "month");
        if (!string.IsNullOrWhiteSpace(month))
            path += $"?month={Uri.EscapeDataString(month)}";

        var body = await _api.GetRawAsync(path, ct);
        return body is null
            ? Error($"Dashboard for schedule '{scheduleId}' is unavailable.")
            : Ok(new { scheduleId, dashboard = AsRaw(body) });
    }

    // ------------------------------------------------ enrollments (write)

    private static readonly string[] EnrollmentUpdatableFields =
        ["status", "schedulePrice", "enrollmentDate"];

    private async Task<string> UpdateEnrollmentAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var result = await _api.UpdateEntityAsync(
            $"/api/v1/enrollments/{Uri.EscapeDataString(id)}", args, EnrollmentUpdatableFields, ct);
        return FromApiResult(result);
    }

    // ------------------------------------------ student payments (read/write)

    private async Task<string> ListStudentPaymentsAsync(JsonElement args, CancellationToken ct)
    {
        var query = BuildQuery(
            ("enrollmentId", GetString(args, "enrollmentId")),
            ("studentId", GetString(args, "studentId")),
            ("from", GetString(args, "from")),
            ("to", GetString(args, "to")),
            ("limit", DefaultLimit.ToString()));

        var body = await _api.GetRawAsync($"/api/v1/student-payments{query}", ct);
        return body is null
            ? Error("Could not list student payments.")
            : Ok(new { payments = AsRaw(body) });
    }

    private static readonly string[] StudentPaymentUpdatableFields =
        ["date", "amount", "installmentNumber", "paymentMethod", "hasReceipt", "receiptNumber", "notes"];

    private async Task<string> UpdateStudentPaymentAsync(JsonElement args, CancellationToken ct)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id))
            return Error("Missing required argument 'id'.");

        var result = await _api.UpdateEntityAsync(
            $"/api/v1/student-payments/{Uri.EscapeDataString(id)}", args, StudentPaymentUpdatableFields, ct);
        return FromApiResult(result);
    }

    // ------------------------------------------ teacher payments (read/write)

    private async Task<string> CreateTeacherPaymentAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateTeacherPaymentRequest(
            TeacherId: GetString(args, "teacherId") ?? string.Empty,
            Date: GetString(args, "date") ?? string.Empty,
            Amount: GetDecimal(args, "amount"),
            Concept: GetString(args, "concept"),
            PaymentMethod: GetString(args, "paymentMethod"),
            Notes: GetString(args, "notes"));

        var result = await _api.CreateTeacherPaymentAsync(request, ct);
        return FromApiResult(result);
    }

    private async Task<string> ListTeacherPaymentsAsync(JsonElement args, CancellationToken ct)
    {
        var query = BuildQuery(
            ("teacherId", GetString(args, "teacherId")),
            ("from", GetString(args, "from")),
            ("to", GetString(args, "to")),
            ("limit", DefaultLimit.ToString()));

        var body = await _api.GetRawAsync($"/api/v1/teacher-payments{query}", ct);
        return body is null
            ? Error("Could not list teacher payments.")
            : Ok(new { payments = AsRaw(body) });
    }

    // ------------------------------------------------ expenses (read/write)

    private async Task<string> CreateExpenseAsync(JsonElement args, CancellationToken ct)
    {
        var request = new EspacioProApiClient.CreateExpenseRequest(
            Date: GetString(args, "date") ?? string.Empty,
            Category: GetString(args, "category"),
            Description: GetString(args, "description"),
            Amount: GetDecimal(args, "amount"),
            PaymentMethod: GetString(args, "paymentMethod"),
            ScheduleId: GetString(args, "scheduleId"),
            Notes: GetString(args, "notes"));

        var result = await _api.CreateExpenseAsync(request, ct);
        return FromApiResult(result);
    }

    private async Task<string> ListExpensesAsync(JsonElement args, CancellationToken ct)
    {
        var query = BuildQuery(
            ("from", GetString(args, "from")),
            ("to", GetString(args, "to")),
            ("category", GetString(args, "category")),
            ("scheduleId", GetString(args, "scheduleId")),
            ("limit", DefaultLimit.ToString()));

        var body = await _api.GetRawAsync($"/api/v1/expenses{query}", ct);
        return body is null
            ? Error("Could not list expenses.")
            : Ok(new { expenses = AsRaw(body) });
    }

    // ------------------------------------------------ operational / catalog

    private async Task<string> QueryDebtorsAsync(JsonElement args, CancellationToken ct)
    {
        var scheduleId = GetString(args, "scheduleId");
        var month = GetString(args, "month");
        if (string.IsNullOrWhiteSpace(scheduleId))
            return Error("Missing required argument 'scheduleId'.");
        if (string.IsNullOrWhiteSpace(month))
            return Error("Missing required argument 'month' (format yyyy-MM).");

        var query = BuildQuery(("scheduleId", scheduleId), ("month", month));
        var body = await _api.GetRawAsync($"/api/v1/student-payments/debtors{query}", ct);
        return body is null
            ? Error($"Could not compute debtors for schedule '{scheduleId}'.")
            : Ok(new { debtors = AsRaw(body) });
    }

    private async Task<string> AddCatalogItemAsync(JsonElement args, CancellationToken ct)
    {
        var code = GetString(args, "code");
        var value = GetString(args, "value");
        if (string.IsNullOrWhiteSpace(code))
            return Error("Missing required argument 'code'.");
        if (string.IsNullOrWhiteSpace(value))
            return Error("Missing required argument 'value'.");

        var request = new EspacioProApiClient.AddCatalogItemRequest(
            Value: value,
            Order: GetIntOrNull(args, "order"));

        var result = await _api.AddCatalogItemAsync(code, request, ct);
        return FromApiResult(result);
    }

    // --------------------------------------------------------------- helpers

    /// <summary>Builds a "?a=1&amp;b=2" query string, skipping null/blank values (URL-encoded).</summary>
    private static string BuildQuery(params (string Key, string? Value)[] parameters)
    {
        var parts = parameters
            .Where(p => !string.IsNullOrWhiteSpace(p.Value))
            .Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value!)}")
            .ToArray();
        return parts.Length == 0 ? string.Empty : "?" + string.Join("&", parts);
    }

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

    private static int? GetIntOrNull(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetInt32(),
            JsonValueKind.String when int.TryParse(v.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) => i,
            _ => null,
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
