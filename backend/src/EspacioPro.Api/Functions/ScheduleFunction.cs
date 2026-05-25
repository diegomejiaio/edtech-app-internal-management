using System.Globalization;
using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Common;
using EspacioPro.Application.Schedules;
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
    private readonly CatalogRepository _catalogRepo;
    private readonly TeacherRepository _teacherRepo;
    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly StudentPaymentRepository _paymentRepo;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ScheduleFunction> _logger;

    public ScheduleFunction(
        ScheduleRepository repo,
        CatalogRepository catalogRepo,
        TeacherRepository teacherRepo,
        EnrollmentRepository enrollmentRepo,
        StudentPaymentRepository paymentRepo,
        ICurrentUser currentUser,
        ILogger<ScheduleFunction> logger)
    {
        _repo = repo;
        _catalogRepo = catalogRepo;
        _teacherRepo = teacherRepo;
        _enrollmentRepo = enrollmentRepo;
        _paymentRepo = paymentRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>GET /api/v1/schedules — paginated list with optional status/teacherId/course/startDate filters.</summary>
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
        var search = req.Query["search"].FirstOrDefault();
        var statusRaw = req.Query["status"].FirstOrDefault();
        var teacherId = req.Query["teacherId"].FirstOrDefault();
        var course = req.Query["course"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        if (!TryParseDate(req.Query["startDateFrom"].FirstOrDefault(), out var startDateFrom))
            return req.ValidationError("startDateFrom", "startDateFrom must be ISO date YYYY-MM-DD.");
        if (!TryParseDate(req.Query["startDateTo"].FirstOrDefault(), out var startDateTo))
            return req.ValidationError("startDateTo", "startDateTo must be ISO date YYYY-MM-DD.");

        ScheduleStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<ScheduleStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: active, inProgress, finished, cancelled.");
            status = parsed;
        }

        var (items, total) = await _repo.SearchAsync(
            search,
            status,
            teacherId,
            course,
            startDateFrom,
            startDateTo,
            includeInactive,
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
        await EnsureAttendanceForActiveEnrollmentsAsync(schedule, ct);

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

        var context = await LoadWriteContextAsync(body, ct);
        if (context.Errors.Count > 0)
            return req.ValidationError(context.Errors);

        var schedule = MapToEntity(body, new Schedule(), context.Teacher!);
        schedule.CourseDurationHours = context.CourseDurationHours;
        schedule.Sessions = [.. ScheduleSessionGenerator.Generate(
            schedule,
            context.CourseDurationHours,
            _currentUser.GetAuditUser())];
        ScheduleSessionGenerator.ApplyProjection(schedule);
        var created = await _repo.CreateAsync(schedule, ct);

        return req.Created(ScheduleResponse.From(created, 0), $"v1/schedules/{created.Id}");
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

        var context = await LoadWriteContextAsync(body, ct);
        if (context.Errors.Count > 0)
            return req.ValidationError(context.Errors);

        var previous = CloneScheduleForRegenerationCheck(existing);
        MapToEntity(body, existing, context.Teacher!);
        existing.CourseDurationHours = context.CourseDurationHours;
        if (ScheduleSessionGenerator.RequiresRegeneration(previous, existing))
        {
            try
            {
                existing.Sessions = [.. ScheduleSessionGenerator.RegeneratePreservingFinalized(
                    existing,
                    context.CourseDurationHours,
                    _currentUser.GetAuditUser())];
            }
            catch (ScheduleSessionRegenerationException ex)
            {
                return req.Conflict(ex.Message);
            }
        }
        ScheduleSessionGenerator.ApplyProjection(existing);

        // Honor If-Match for optimistic concurrency (docs §17).
        var ifMatch = req.Headers.IfMatch.FirstOrDefault();
        if (!string.IsNullOrEmpty(ifMatch))
            existing.ETag = ifMatch;

        try
        {
            var updated = await _repo.UpdateAsync(existing, ct);
            var count = await _enrollmentRepo.CountActiveByScheduleAsync(id, ct);
            return new OkObjectResult(ScheduleResponse.From(updated, count));
        }
        catch (Microsoft.Azure.Cosmos.CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.PreconditionFailed)
        {
            return req.PreconditionFailed($"Schedule '{id}' was modified by another request.");
        }
    }

    /// <summary>GET /api/v1/schedules/{id}/sessions — generated sessions with in-memory bounded pagination.</summary>
    [Function("ScheduleSessionList")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListSessions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules/{id}/sessions")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var schedule = await _repo.GetByIdAsync(id, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{id}' not found.");

        if (!TryParseDate(req.Query["from"].FirstOrDefault(), out var from))
            return req.ValidationError("from", "from must be ISO date YYYY-MM-DD.");
        if (!TryParseDate(req.Query["to"].FirstOrDefault(), out var to))
            return req.ValidationError("to", "to must be ISO date YYYY-MM-DD.");

        ScheduleSessionStatus? status = null;
        var statusRaw = req.Query["status"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<ScheduleSessionStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: scheduled, completed, cancelled.");
            status = parsed;
        }

        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));
        var filtered = schedule.Sessions
            .Where(s => s.Active)
            .Where(s => from is null || s.Date >= from.Value)
            .Where(s => to is null || s.Date <= to.Value)
            .Where(s => status is null || s.Status == status)
            .OrderBy(s => s.Date)
            .ThenBy(s => s.StartTime)
            .ThenBy(s => s.SequenceNumber)
            .ToArray();

        return new OkObjectResult(new Paginated<ScheduleSession>(
            filtered.Skip(offset).Take(limit).ToArray(),
            filtered.Length,
            limit,
            offset));
    }

    /// <summary>GET /api/v1/schedules/{scheduleId}/sessions/{sessionId}.</summary>
    [Function("ScheduleSessionGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetSessionById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/schedules/{scheduleId}/sessions/{sessionId}")] HttpRequest req,
        string scheduleId,
        string sessionId,
        CancellationToken ct)
    {
        var schedule = await _repo.GetByIdAsync(scheduleId, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{scheduleId}' not found.");
        await EnsureAttendanceForActiveEnrollmentsAsync(schedule, ct);

        var session = schedule.Sessions.FirstOrDefault(s => s.Id == sessionId && s.Active);
        if (session is null)
            return req.NotFound($"Session '{sessionId}' not found.");

        return new OkObjectResult(session);
    }

    /// <summary>PUT /api/v1/schedules/{scheduleId}/sessions/{sessionId} — update status/attendance with If-Match.</summary>
    [Function("ScheduleSessionUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> UpdateSession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/schedules/{scheduleId}/sessions/{sessionId}")] HttpRequest req,
        string scheduleId,
        string sessionId,
        CancellationToken ct)
    {
        var schedule = await _repo.GetByIdAsync(scheduleId, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{scheduleId}' not found.");

        var body = await req.ReadFromJsonAsync<ScheduleSessionWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var session = schedule.Sessions.FirstOrDefault(s => s.Id == sessionId && s.Active);
        if (session is null)
            return req.NotFound($"Session '{sessionId}' not found.");
        await EnsureAttendanceForActiveEnrollmentsAsync(schedule, ct);

        var auditUser = _currentUser.GetAuditUser();
        var now = DateTime.UtcNow.ToString("o");
        if (body.Status is { } status)
            session.Status = status;
        session.UpdatedAt = now;
        session.UpdatedBy = auditUser;
        if (body.Attendance is not null)
        {
            var byStudentId = body.Attendance.ToDictionary(a => a.StudentId.Trim(), StringComparer.Ordinal);
            foreach (var entry in session.Attendance)
            {
                if (!byStudentId.TryGetValue(entry.StudentId, out var update))
                    continue;
                entry.Status = update.Status;
                entry.Notes = string.IsNullOrWhiteSpace(update.Notes) ? null : update.Notes.Trim();
                entry.UpdatedAt = now;
                entry.UpdatedBy = auditUser;
            }
        }

        var ifMatch = req.Headers.IfMatch.FirstOrDefault();
        if (!string.IsNullOrEmpty(ifMatch))
            schedule.ETag = ifMatch;

        try
        {
            var updated = await _repo.UpdateAsync(schedule, ct);
            var updatedSession = updated.Sessions.First(s => s.Id == sessionId);
            return new OkObjectResult(new ScheduleSessionUpdateResponse
            {
                Session = updatedSession,
                ScheduleETag = updated.ETag,
            });
        }
        catch (Microsoft.Azure.Cosmos.CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.PreconditionFailed)
        {
            return req.PreconditionFailed($"Schedule '{scheduleId}' was modified by another request.");
        }
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

    private static bool TryParseDate(string? raw, out DateOnly? date)
    {
        date = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;
        if (DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
        {
            date = d;
            return true;
        }
        return false;
    }

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
        else if (!ScheduleWeekdayParser.TryNormalizeCanonical(req.Weekdays, out _))
            errors["weekdays"] = [$"weekdays must be one of: {ScheduleWeekdayParser.CanonicalListForMessage()}."];
        if (req.Capacity <= 0)
            errors["capacity"] = ["Capacity must be greater than zero."];
        if (req.Price < 0)
            errors["price"] = ["Price cannot be negative."];
        if (req.EndTime <= req.StartTime)
            errors["endTime"] = ["endTime must be later than startTime."];

        return errors;
    }

    private async Task<ScheduleWriteContext> LoadWriteContextAsync(ScheduleWriteRequest body, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();

        var teacher = await _teacherRepo.GetByIdAsync(body.TeacherId!, ct);
        if (teacher is null || !teacher.Active)
            errors["teacherId"] = [$"Teacher '{body.TeacherId}' does not exist or is inactive."];

        var courses = await _catalogRepo.GetByCodeAsync("courses", ct);
        var levels = await _catalogRepo.GetByCodeAsync("levels", ct);
        var weekdays = await _catalogRepo.GetByCodeAsync("weekdays", ct);

        if (courses is null || !courses.Items.Any(i => i.Active && i.Value.Equals(body.Course, StringComparison.OrdinalIgnoreCase)))
            errors["course"] = [$"Course '{body.Course}' does not exist or is inactive."];
        if (levels is null || !levels.Items.Any(i => i.Active && i.Value.Equals(body.Level, StringComparison.OrdinalIgnoreCase)))
            errors["level"] = [$"Level '{body.Level}' does not exist or is inactive."];
        var normalizedWeekdays = ScheduleWeekdayParser.TryNormalizeCanonical(body.Weekdays, out var canonicalWeekdays)
            ? canonicalWeekdays
            : body.Weekdays;

        if (weekdays is null || !weekdays.Items.Any(i =>
                i.Active
                && ScheduleWeekdayParser.TryNormalizeCanonical(i.Value, out var catalogWeekdays)
                && catalogWeekdays.Equals(normalizedWeekdays, StringComparison.Ordinal)))
            errors["weekdays"] = [$"Weekdays '{body.Weekdays}' does not exist or is inactive."];

        var durationHours = 0m;
        if (courses is not null
            && !string.IsNullOrWhiteSpace(body.Course)
            && !string.IsNullOrWhiteSpace(body.Level)
            && !ScheduleDurationResolver.TryResolve(courses, body.Course, body.Level, out durationHours))
        {
            errors["courseDurationHours"] = [$"Duration metadata is missing for course '{body.Course}' and level '{body.Level}'."];
        }

        return new ScheduleWriteContext(teacher, durationHours, errors);
    }

    private static Schedule CloneScheduleForRegenerationCheck(Schedule schedule) => new()
    {
        Course = schedule.Course,
        Level = schedule.Level,
        Weekdays = schedule.Weekdays,
        StartDate = schedule.StartDate,
        StartTime = schedule.StartTime,
        EndTime = schedule.EndTime,
        Sessions = schedule.Sessions,
    };

    private static Schedule MapToEntity(ScheduleWriteRequest req, Schedule target, Teacher teacher)
    {
        target.Course = req.Course!.Trim();
        target.Level = req.Level!.Trim();
        target.TeacherId = teacher.Id;
        target.TeacherName = $"{teacher.FirstName} {teacher.LastName}".Trim();
        target.Weekdays = ScheduleWeekdayParser.TryNormalizeCanonical(req.Weekdays, out var weekdays)
            ? weekdays
            : req.Weekdays!.Trim();
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

    private async Task EnsureAttendanceForActiveEnrollmentsAsync(Schedule schedule, CancellationToken ct)
    {
        var (enrollments, _) = await _enrollmentRepo.SearchAsync(
            studentId: null,
            scheduleId: schedule.Id,
            status: EnrollmentStatus.Active,
            includeInactive: false,
            limit: 500,
            offset: 0,
            ct);

        var activeByStudentId = enrollments
            .GroupBy(e => e.StudentId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        foreach (var session in schedule.Sessions.Where(s => s.Active))
        {
            session.Attendance = [.. session.Attendance
                .Where(a => activeByStudentId.ContainsKey(a.StudentId))
                .GroupBy(a => a.StudentId, StringComparer.Ordinal)
                .Select(g => g.First())];

            var existing = session.Attendance
                .Select(a => a.StudentId)
                .ToHashSet(StringComparer.Ordinal);

            foreach (var enrollment in activeByStudentId.Values.OrderBy(e => e.StudentName, StringComparer.OrdinalIgnoreCase))
            {
                if (existing.Contains(enrollment.StudentId))
                    continue;

                session.Attendance.Add(new ScheduleAttendance
                {
                    EnrollmentId = enrollment.Id,
                    StudentId = enrollment.StudentId,
                    StudentName = enrollment.StudentName,
                    Status = AttendanceStatus.Pending,
                });
            }
        }
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

    private sealed record ScheduleWriteContext(
        Teacher? Teacher,
        decimal CourseDurationHours,
        Dictionary<string, string[]> Errors);

    private sealed record ScheduleSessionWriteRequest(
        ScheduleSessionStatus? Status,
        List<ScheduleAttendanceWriteRequest>? Attendance);

    private sealed record ScheduleAttendanceWriteRequest(
        string StudentId,
        AttendanceStatus Status,
        string? Notes);
}
