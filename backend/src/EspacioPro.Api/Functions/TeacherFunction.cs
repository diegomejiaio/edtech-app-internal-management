using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Teacher CRUD endpoints (M2) per <c>docs/04-api-design.md §5.3</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
public sealed class TeacherFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly TeacherRepository _repo;
    private readonly ScheduleRepository _scheduleRepo;
    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly TeacherPaymentRepository _teacherPaymentRepo;
    private readonly ILogger<TeacherFunction> _logger;

    public TeacherFunction(
        TeacherRepository repo,
        ScheduleRepository scheduleRepo,
        EnrollmentRepository enrollmentRepo,
        TeacherPaymentRepository teacherPaymentRepo,
        ILogger<TeacherFunction> logger)
    {
        _repo = repo;
        _scheduleRepo = scheduleRepo;
        _enrollmentRepo = enrollmentRepo;
        _teacherPaymentRepo = teacherPaymentRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/teachers — paginated list with optional search/specialty filter.</summary>
    [Function("TeacherList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teachers")] HttpRequest req,
        CancellationToken ct)
    {
        var search = req.Query["search"].FirstOrDefault();
        var specialty = req.Query["specialty"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        var (items, total) = await _repo.SearchAsync(search, specialty, includeInactive, limit, offset, ct);
        return new OkObjectResult(new Paginated<Teacher>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/teachers/{id}.</summary>
    [Function("TeacherGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teachers/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var teacher = await _repo.GetByIdAsync(id, ct);
        return teacher is null
            ? req.NotFound($"Teacher '{id}' not found.")
            : new OkObjectResult(teacher);
    }

    /// <summary>POST /api/v1/teachers — create. 409 if (docType, docNumber) already active.</summary>
    [Function("TeacherCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/teachers")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<TeacherWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var existing = await _repo.GetByDocAsync(body.DocType, body.DocNumber!, ct);
        if (existing is not null)
            return req.Duplicate(
                $"A teacher with {body.DocType.ToString().ToLowerInvariant()} {body.DocNumber} already exists.");

        var teacher = MapToEntity(body, new Teacher());
        var created = await _repo.CreateAsync(teacher, ct);

        return req.Created(created, $"v1/teachers/{created.Id}");
    }

    /// <summary>PUT /api/v1/teachers/{id} — full replace.</summary>
    [Function("TeacherUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/teachers/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Teacher '{id}' not found.");

        var body = await req.ReadFromJsonAsync<TeacherWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        // Dedup against another teacher.
        var dup = await _repo.GetByDocAsync(body.DocType, body.DocNumber!, ct);
        if (dup is not null && !string.Equals(dup.Id, id, StringComparison.Ordinal))
            return req.Duplicate(
                $"Another teacher with {body.DocType.ToString().ToLowerInvariant()} {body.DocNumber} already exists.");

        MapToEntity(body, existing);
        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/teachers/{id} — soft delete. Returns 204.</summary>
    /// <remarks>
    /// Returns 409 <c>dependent-records</c> if assigned to a Schedule with status active or inProgress
    /// (api-design §5.3).
    /// </remarks>
    [Function("TeacherDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/teachers/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Teacher '{id}' not found.");

        var activeSchedules = await _scheduleRepo.CountActiveByTeacherAsync(id, ct);
        if (activeSchedules > 0)
            return req.DependentRecords(
                $"Cannot delete teacher '{id}': {activeSchedules} active or in-progress schedule(s) assigned.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    // --- Nested collection endpoints (api-design §5.3) ---

    /// <summary>GET /api/v1/teachers/{id}/payments — teacher payments with optional date range.</summary>
    [Function("TeacherPaymentListByTeacher")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListPayments(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teachers/{teacherId}/payments")] HttpRequest req,
        string teacherId,
        CancellationToken ct)
    {
        var fromRaw = req.Query["from"].FirstOrDefault();
        var toRaw = req.Query["to"].FirstOrDefault();
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        DateOnly? from = DateOnly.TryParse(fromRaw, out var f) ? f : null;
        DateOnly? to = DateOnly.TryParse(toRaw, out var t) ? t : null;

        var (items, total) = await _teacherPaymentRepo.SearchAsync(teacherId, from, to, includeInactive: false, limit, offset, ct);
        return new OkObjectResult(new Paginated<TeacherPayment>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/teachers/{id}/schedules — schedules assigned to this teacher.</summary>
    [Function("ScheduleListByTeacher")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListSchedules(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teachers/{teacherId}/schedules")] HttpRequest req,
        string teacherId,
        CancellationToken ct)
    {
        var statusRaw = req.Query["status"].FirstOrDefault();
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        ScheduleStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<ScheduleStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, inProgress, finished, cancelled.");
            status = parsed;
        }

        var (items, total) = await _scheduleRepo.SearchAsync(
            status,
            teacherId,
            course: null,
            startDateFrom: null,
            startDateTo: null,
            includeInactive: false,
            limit,
            offset,
            ct);

        var responses = new List<ScheduleResponse>(items.Count);
        foreach (var s in items)
        {
            var count = await _enrollmentRepo.CountActiveByScheduleAsync(s.Id, ct);
            responses.Add(ScheduleResponse.From(s, count));
        }

        return new OkObjectResult(new Paginated<ScheduleResponse>(responses, total, limit, offset));
    }

    // --- Helpers ---

    private static int ClampLimit(string? raw) =>
        Math.Clamp(ParseInt(raw, DefaultLimit), 1, MaxLimit);

    private static int ParseInt(string? raw, int fallback) =>
        int.TryParse(raw, out var v) ? v : fallback;

    private static bool ParseBool(string? raw) =>
        bool.TryParse(raw, out var v) && v;

    private static Dictionary<string, string[]> Validate(TeacherWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(req.FirstName))
            errors["firstName"] = ["The firstName field is required."];
        if (string.IsNullOrWhiteSpace(req.LastName))
            errors["lastName"] = ["The lastName field is required."];
        if (string.IsNullOrWhiteSpace(req.DocNumber))
            errors["docNumber"] = ["The docNumber field is required."];
        else if (!DocumentValidation.IsValid(req.DocType, req.DocNumber))
            errors["docNumber"] = [DocumentValidation.ErrorMessage(req.DocType)];
        if (!EmailValidation.IsValid(req.Email))
            errors["email"] = ["Email format is invalid."];

        return errors;
    }

    private static Teacher MapToEntity(TeacherWriteRequest req, Teacher target)
    {
        target.FirstName = req.FirstName!.Trim();
        target.LastName = req.LastName!.Trim();
        target.DocType = req.DocType;
        target.DocNumber = req.DocNumber!.Trim();
        target.Phone = req.Phone?.Trim();
        target.Email = req.Email?.Trim();
        target.Specialty = req.Specialty?.Trim();
        target.ClerkUserId = req.ClerkUserId?.Trim();
        if (req.Active is { } active)
            target.Active = active;
        return target;
    }

    private sealed record TeacherWriteRequest(
        string? FirstName,
        string? LastName,
        DocType DocType,
        string? DocNumber,
        string? Phone,
        string? Email,
        string? Specialty,
        string? ClerkUserId,
        bool? Active);
}
