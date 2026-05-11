using System.Globalization;
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
/// Schedule CRUD endpoints (M4) per <c>docs/04-api-design.md §5.4</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
public sealed class ScheduleFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly ScheduleRepository _repo;
    private readonly TeacherRepository _teacherRepo;
    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly StudentPaymentRepository _paymentRepo;
    private readonly ILogger<ScheduleFunction> _logger;

    public ScheduleFunction(
        ScheduleRepository repo,
        TeacherRepository teacherRepo,
        EnrollmentRepository enrollmentRepo,
        StudentPaymentRepository paymentRepo,
        ILogger<ScheduleFunction> logger)
    {
        _repo = repo;
        _teacherRepo = teacherRepo;
        _enrollmentRepo = enrollmentRepo;
        _paymentRepo = paymentRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/schedules — paginated list with optional status/teacherId/course filter.</summary>
    /// <remarks>
    /// Each item carries <c>enrolledActiveCount</c> + <c>occupancyPct</c> per §3.4 (computed at read).
    /// Implementation does N count queries per page (~3 RU each). At default limit=25 this is ~75 RU.
    /// Acceptable for v1 scale; revisit if pagination grows.
    /// </remarks>
    [Function("ScheduleList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules")] HttpRequest req,
        CancellationToken ct)
    {
        var statusRaw = req.Query["status"].FirstOrDefault();
        var teacherId = req.Query["teacherId"].FirstOrDefault();
        var course = req.Query["course"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        ScheduleStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<ScheduleStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, inProgress, finished, cancelled.");
            status = parsed;
        }

        var (items, total) = await _repo.SearchAsync(status, teacherId, course, includeInactive, limit, offset, ct);

        var responses = new List<ScheduleResponse>(items.Count);
        foreach (var s in items)
        {
            var count = await _enrollmentRepo.CountActiveByScheduleAsync(s.Id, ct);
            responses.Add(ScheduleResponse.From(s, count));
        }

        return new OkObjectResult(new Paginated<ScheduleResponse>(responses, total, limit, offset));
    }

    /// <summary>GET /api/v1/schedules/{id} — includes computed enrolledActiveCount + occupancyPct.</summary>
    [Function("ScheduleGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var schedule = await _repo.GetByIdAsync(id, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{id}' not found.");

        var count = await _enrollmentRepo.CountActiveByScheduleAsync(id, ct);
        return new OkObjectResult(ScheduleResponse.From(schedule, count));
    }

    /// <summary>POST /api/v1/schedules — create. Validates teacherId exists + active. Snapshots teacherName.</summary>
    [Function("ScheduleCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/schedules")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<ScheduleWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var teacher = await _teacherRepo.GetByIdAsync(body.TeacherId!, ct);
        if (teacher is null)
            return req.ValidationError("teacherId", $"Teacher '{body.TeacherId}' does not exist or is inactive.");

        var schedule = MapToEntity(body, new Schedule(), teacher);
        var created = await _repo.CreateAsync(schedule, ct);

        return new ObjectResult(ScheduleResponse.From(created, 0))
        {
            StatusCode = StatusCodes.Status201Created,
        };
    }

    /// <summary>PUT /api/v1/schedules/{id} — full replace. Refreshes teacherName snapshot.</summary>
    [Function("ScheduleUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/schedules/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Schedule '{id}' not found.");

        var body = await req.ReadFromJsonAsync<ScheduleWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var teacher = await _teacherRepo.GetByIdAsync(body.TeacherId!, ct);
        if (teacher is null)
            return req.ValidationError("teacherId", $"Teacher '{body.TeacherId}' does not exist or is inactive.");

        MapToEntity(body, existing, teacher);
        var updated = await _repo.UpdateAsync(existing, ct);
        var count = await _enrollmentRepo.CountActiveByScheduleAsync(id, ct);
        return new OkObjectResult(ScheduleResponse.From(updated, count));
    }

    /// <summary>DELETE /api/v1/schedules/{id} — soft delete. 409 if active enrollments exist.</summary>
    [Function("ScheduleDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/schedules/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Schedule '{id}' not found.");

        var activeCount = await _enrollmentRepo.CountActiveByScheduleAsync(id, ct);
        if (activeCount > 0)
            return req.DependentRecords(
                $"Cannot delete schedule '{id}': {activeCount} active enrollment(s) exist.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    /// <summary>
    /// GET /api/v1/schedules/{id}/dashboard?month=YYYY-MM — composite read view (M9).
    /// Per <c>docs/04-api-design.md §6.1</c>: schedule + active enrollments + per-enrollment
    /// paid/debtor flag for the requested month, plus aggregate summary.
    /// </summary>
    /// <remarks>
    /// Query plan (3 round-trips, ~10–15 RU total at v1 scale):
    /// <list type="number">
    ///   <item>Q1: point read schedule by id.</item>
    ///   <item>Q2: active enrollments for the schedule (single-partition).</item>
    ///   <item>Q3: <c>MAX(date)</c> per enrollment for active payments inside the month window.</item>
    /// </list>
    /// Defaults <paramref name="req"/>.month to the current UTC month when omitted.
    /// </remarks>
    [Function("ScheduleDashboard")]
    [RequireRole("admin")]
    public async Task<IActionResult> Dashboard(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules/{id}/dashboard")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var monthRaw = req.Query["month"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(monthRaw))
        {
            var now = DateTime.UtcNow;
            monthRaw = $"{now.Year:D4}-{now.Month:D2}";
        }

        if (!TryParseMonth(monthRaw, out var monthStart, out var monthEnd))
            return req.ValidationError("month", "month must be YYYY-MM (e.g. 2026-05).");

        // Q1: schedule by id.
        var schedule = await _repo.GetByIdAsync(id, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{id}' not found.");

        // Q2: active enrollments for the schedule.
        var (enrollments, _) = await _enrollmentRepo.SearchAsync(
            studentId: null,
            scheduleId: id,
            status: EnrollmentStatus.Active,
            includeInactive: false,
            limit: 500,
            offset: 0,
            ct);

        // Q3: last-payment-date per enrollment within the month.
        var enrollmentIds = enrollments.Select(e => e.Id).ToArray();
        var lastDates = await _paymentRepo.GetLastPaymentDatesAsync(enrollmentIds, monthStart, monthEnd, ct);

        var dashboard = ScheduleDashboardResponse.From(schedule, monthRaw, enrollments, lastDates);
        return new OkObjectResult(dashboard);
    }

    // --- Helpers ---

    private static bool TryParseMonth(string raw, out DateOnly start, out DateOnly end)
    {
        if (DateTime.TryParseExact(raw, "yyyy-MM", CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var dt))
        {
            start = new DateOnly(dt.Year, dt.Month, 1);
            end = start.AddMonths(1).AddDays(-1);
            return true;
        }
        start = default;
        end = default;
        return false;
    }

    private static int ClampLimit(string? raw) =>
        Math.Clamp(ParseInt(raw, DefaultLimit), 1, MaxLimit);

    private static int ParseInt(string? raw, int fallback) =>
        int.TryParse(raw, out var v) ? v : fallback;

    private static bool ParseBool(string? raw) =>
        bool.TryParse(raw, out var v) && v;

    private static Dictionary<string, string[]> Validate(ScheduleWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(req.Course))
            errors["course"] = ["The course field is required."];
        if (string.IsNullOrWhiteSpace(req.Level))
            errors["level"] = ["The level field is required."];
        if (string.IsNullOrWhiteSpace(req.TeacherId))
            errors["teacherId"] = ["The teacherId field is required."];
        if (string.IsNullOrWhiteSpace(req.Weekdays))
            errors["weekdays"] = ["The weekdays field is required."];
        if (req.Capacity <= 0)
            errors["capacity"] = ["Capacity must be greater than zero."];
        if (req.Price < 0)
            errors["price"] = ["Price cannot be negative."];
        if (req.EndTime <= req.StartTime)
            errors["endTime"] = ["endTime must be later than startTime."];

        return errors;
    }

    private static Schedule MapToEntity(ScheduleWriteRequest req, Schedule target, Teacher teacher)
    {
        target.Course = req.Course!.Trim();
        target.Level = req.Level!.Trim();
        target.TeacherId = teacher.Id;
        target.TeacherName = $"{teacher.FirstName} {teacher.LastName}".Trim();
        target.Weekdays = req.Weekdays!.Trim();
        target.StartTime = req.StartTime;
        target.EndTime = req.EndTime;
        target.Price = req.Price;
        target.Capacity = req.Capacity;
        target.Status = req.Status;
        target.StartDate = req.StartDate;
        if (req.Active is { } active)
            target.Active = active;
        return target;
    }

    private sealed record ScheduleWriteRequest(
        string? Course,
        string? Level,
        string? TeacherId,
        string? Weekdays,
        TimeOnly StartTime,
        TimeOnly EndTime,
        decimal Price,
        int Capacity,
        ScheduleStatus Status,
        DateOnly StartDate,
        bool? Active);
}
