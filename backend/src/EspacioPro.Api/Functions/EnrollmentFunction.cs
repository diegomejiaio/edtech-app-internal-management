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
/// Enrollment CRUD endpoints (M5) per <c>docs/04-api-design.md §5.5</c>.
/// Cross-aggregate orchestration (snapshot Student + Schedule into Enrollment) lives here.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
public sealed class EnrollmentFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly EnrollmentRepository _repo;
    private readonly StudentRepository _studentRepo;
    private readonly ScheduleRepository _scheduleRepo;
    private readonly ILogger<EnrollmentFunction> _logger;

    public EnrollmentFunction(
        EnrollmentRepository repo,
        StudentRepository studentRepo,
        ScheduleRepository scheduleRepo,
        ILogger<EnrollmentFunction> logger)
    {
        _repo = repo;
        _studentRepo = studentRepo;
        _scheduleRepo = scheduleRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/enrollments — paginated list with optional studentId/scheduleId/status filter.</summary>
    [Function("EnrollmentList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/enrollments")] HttpRequest req,
        CancellationToken ct)
    {
        var studentId = req.Query["studentId"].FirstOrDefault();
        var scheduleId = req.Query["scheduleId"].FirstOrDefault();
        var statusRaw = req.Query["status"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        EnrollmentStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<EnrollmentStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, completed, cancelled, pending.");
            status = parsed;
        }

        var (items, total) = await _repo.SearchAsync(studentId, scheduleId, status, includeInactive, limit, offset, ct);
        return new OkObjectResult(new Paginated<Enrollment>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/enrollments/{id}.</summary>
    [Function("EnrollmentGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/enrollments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var e = await _repo.GetByIdAsync(id, ct);
        return e is null
            ? req.NotFound($"Enrollment '{id}' not found.")
            : new OkObjectResult(e);
    }

    /// <summary>
    /// POST /api/v1/enrollments — create. Validates student + schedule exist + active.
    /// 409 if (studentId, scheduleId) active enrollment already exists. Snapshots both.
    /// </summary>
    [Function("EnrollmentCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/enrollments")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<EnrollmentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var student = await _studentRepo.GetByIdAsync(body.StudentId!, ct);
        if (student is null)
            return req.ValidationError("studentId", $"Student '{body.StudentId}' does not exist or is inactive.");

        var schedule = await _scheduleRepo.GetByIdAsync(body.ScheduleId!, ct);
        if (schedule is null)
            return req.ValidationError("scheduleId", $"Schedule '{body.ScheduleId}' does not exist or is inactive.");

        if (await _repo.ExistsActiveAsync(student.Id, schedule.Id, ct))
            return req.Duplicate(
                $"Student '{student.Id}' already has an active enrollment in schedule '{schedule.Id}'.");

        var enrollment = MapToEntity(body, new Enrollment(), student, schedule);
        var created = await _repo.CreateAsync(enrollment, ct);

        return new ObjectResult(created)
        {
            StatusCode = StatusCodes.Status201Created,
        };
    }

    /// <summary>PUT /api/v1/enrollments/{id} — full replace. Refreshes snapshots from current Student + Schedule.</summary>
    [Function("EnrollmentUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/enrollments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Enrollment '{id}' not found.");

        var body = await req.ReadFromJsonAsync<EnrollmentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var student = await _studentRepo.GetByIdAsync(body.StudentId!, ct);
        if (student is null)
            return req.ValidationError("studentId", $"Student '{body.StudentId}' does not exist or is inactive.");

        var schedule = await _scheduleRepo.GetByIdAsync(body.ScheduleId!, ct);
        if (schedule is null)
            return req.ValidationError("scheduleId", $"Schedule '{body.ScheduleId}' does not exist or is inactive.");

        // Re-check active uniqueness only if (student, schedule) is changing AND new status will be active.
        var pairChanged =
            !string.Equals(existing.StudentId, student.Id, StringComparison.Ordinal) ||
            !string.Equals(existing.ScheduleId, schedule.Id, StringComparison.Ordinal);
        if (pairChanged && body.Status == EnrollmentStatus.Active &&
            await _repo.ExistsActiveAsync(student.Id, schedule.Id, ct))
        {
            return req.Duplicate(
                $"Student '{student.Id}' already has an active enrollment in schedule '{schedule.Id}'.");
        }

        MapToEntity(body, existing, student, schedule);
        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/enrollments/{id} — soft delete. Payments stay addressable per §3.5.</summary>
    [Function("EnrollmentDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/enrollments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Enrollment '{id}' not found.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    // --- Nested collection endpoints (api-design §5.2 / §5.4) ---

    /// <summary>GET /api/v1/students/{id}/enrollments — convenience nested URI.</summary>
    [Function("EnrollmentListByStudent")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListByStudent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/students/{studentId}/enrollments")] HttpRequest req,
        string studentId,
        CancellationToken ct)
    {
        var statusRaw = req.Query["status"].FirstOrDefault();
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        EnrollmentStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<EnrollmentStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, completed, cancelled, pending.");
            status = parsed;
        }

        var (items, total) = await _repo.SearchAsync(studentId, scheduleId: null, status, includeInactive: false, limit, offset, ct);
        return new OkObjectResult(new Paginated<Enrollment>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/schedules/{id}/enrollments — convenience nested URI.</summary>
    [Function("EnrollmentListBySchedule")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListBySchedule(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules/{scheduleId}/enrollments")] HttpRequest req,
        string scheduleId,
        CancellationToken ct)
    {
        var statusRaw = req.Query["status"].FirstOrDefault();
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        EnrollmentStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<EnrollmentStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, completed, cancelled, pending.");
            status = parsed;
        }

        var (items, total) = await _repo.SearchAsync(studentId: null, scheduleId, status, includeInactive: false, limit, offset, ct);
        return new OkObjectResult(new Paginated<Enrollment>(items, total, limit, offset));
    }

    // --- Helpers ---

    private static int ClampLimit(string? raw) =>
        Math.Clamp(ParseInt(raw, DefaultLimit), 1, MaxLimit);

    private static int ParseInt(string? raw, int fallback) =>
        int.TryParse(raw, out var v) ? v : fallback;

    private static bool ParseBool(string? raw) =>
        bool.TryParse(raw, out var v) && v;

    private static Dictionary<string, string[]> ValidateBasic(EnrollmentWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(req.StudentId))
            errors["studentId"] = ["The studentId field is required."];
        if (string.IsNullOrWhiteSpace(req.ScheduleId))
            errors["scheduleId"] = ["The scheduleId field is required."];
        if (req.EnrollmentDate == default)
            errors["enrollmentDate"] = ["The enrollmentDate field is required."];

        return errors;
    }

    private static Enrollment MapToEntity(EnrollmentWriteRequest req, Enrollment target, Student student, Schedule schedule)
    {
        target.StudentId = student.Id;
        target.StudentName = $"{student.FirstName} {student.LastName}".Trim();
        target.StudentDoc = $"{student.DocType.ToString().ToUpperInvariant()} {student.DocNumber}";
        target.ScheduleId = schedule.Id;
        target.ScheduleName = $"{schedule.Course} · {schedule.Level} · {schedule.Weekdays} {schedule.StartTime:HH\\:mm}";
        target.SchedulePrice = schedule.Price;
        target.EnrollmentDate = req.EnrollmentDate;
        target.Status = req.Status;
        if (req.Active is { } active)
            target.Active = active;
        return target;
    }

    private sealed record EnrollmentWriteRequest(
        string? StudentId,
        string? ScheduleId,
        DateOnly EnrollmentDate,
        EnrollmentStatus Status,
        bool? Active);
}
