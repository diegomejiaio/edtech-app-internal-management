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
/// StudentPayment CRUD endpoints (M6) per <c>docs/04-api-design.md §5.6</c>, plus the
/// debtors operational endpoint (§6.2). All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
/// <remarks>
/// Snapshot policy: per <c>docs/01-domain-model.md</c> §3.6, snapshots (studentId, studentName,
/// scheduleId, scheduleName) are <b>frozen forever</b> at create time. PUT preserves the
/// originals — only <c>date</c>, <c>amount</c>, <c>installmentNumber</c>, <c>paymentMethod</c>,
/// <c>hasReceipt</c>, <c>receiptNumber</c>, and <c>notes</c> may change.
/// </remarks>
public sealed class StudentPaymentFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly StudentPaymentRepository _repo;
    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly ScheduleRepository _scheduleRepo;
    private readonly ILogger<StudentPaymentFunction> _logger;

    public StudentPaymentFunction(
        StudentPaymentRepository repo,
        EnrollmentRepository enrollmentRepo,
        ScheduleRepository scheduleRepo,
        ILogger<StudentPaymentFunction> logger)
    {
        _repo = repo;
        _enrollmentRepo = enrollmentRepo;
        _scheduleRepo = scheduleRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/student-payments — paginated list with optional enrollmentId/studentId/from/to filters.</summary>
    [Function("StudentPaymentList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/student-payments")] HttpRequest req,
        CancellationToken ct)
    {
        var enrollmentId = req.Query["enrollmentId"].FirstOrDefault();
        var studentId = req.Query["studentId"].FirstOrDefault();
        var search = req.Query["search"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        if (!TryParseDate(req.Query["from"].FirstOrDefault(), out var from))
            return req.ValidationError("from", "from must be ISO date YYYY-MM-DD.");
        if (!TryParseDate(req.Query["to"].FirstOrDefault(), out var to))
            return req.ValidationError("to", "to must be ISO date YYYY-MM-DD.");

        var (items, total) = await _repo.SearchAsync(enrollmentId, studentId, from, to, includeInactive, limit, offset, search, ct);
        return new OkObjectResult(new Paginated<StudentPayment>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/student-payments/{id}.</summary>
    [Function("StudentPaymentGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/student-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var p = await _repo.GetByIdAsync(id, ct);
        return p is null
            ? req.NotFound($"StudentPayment '{id}' not found.")
            : new OkObjectResult(p);
    }

    /// <summary>
    /// POST /api/v1/student-payments — create. Validates enrollment exists+active,
    /// snapshots student/schedule fields from the linked Enrollment (frozen forever).
    /// </summary>
    [Function("StudentPaymentCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/student-payments")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<StudentPaymentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var enrollment = await _enrollmentRepo.GetByIdAsync(body.EnrollmentId!, ct);
        if (enrollment is null || !enrollment.Active)
            return req.ValidationError("enrollmentId", $"Enrollment '{body.EnrollmentId}' does not exist or is inactive.");

        var payment = new StudentPayment
        {
            EnrollmentId = enrollment.Id,
            StudentId = enrollment.StudentId,
            StudentName = enrollment.StudentName,
            ScheduleId = enrollment.ScheduleId,
            ScheduleName = enrollment.ScheduleName,
        };
        ApplyMutableFields(body, payment);

        payment.Code = await ShortCodeGenerator.GenerateUniqueAsync(
            async (candidate, token) => await _repo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
            "PAG-",
            5,
            ct: ct);
        var created = await _repo.CreateAsync(payment, ct);
        return req.Created(created, $"v1/student-payments/{created.Id}");
    }

    /// <summary>
    /// PUT /api/v1/student-payments/{id} — full replace.
    /// Snapshots are preserved (frozen). EnrollmentId is also preserved to keep the
    /// historical link stable.
    /// </summary>
    [Function("StudentPaymentUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/student-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"StudentPayment '{id}' not found.");

        var body = await req.ReadFromJsonAsync<StudentPaymentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        ApplyMutableFields(body, existing);

        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/student-payments/{id} — soft delete.</summary>
    [Function("StudentPaymentDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/student-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"StudentPayment '{id}' not found.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    /// <summary>
    /// GET /api/v1/student-payments/debtors?scheduleId=X&amp;month=YYYY-MM — operational endpoint.
    /// Per <c>docs/04-api-design.md</c> §6.2: lists active enrollments in a schedule that
    /// have no active payment in the given month.
    /// </summary>
    [Function("StudentPaymentDebtors")]
    [RequireRole("admin")]
    public async Task<IActionResult> Debtors(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/student-payments/debtors")] HttpRequest req,
        CancellationToken ct)
    {
        var scheduleId = req.Query["scheduleId"].FirstOrDefault();
        var monthRaw = req.Query["month"].FirstOrDefault();

        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(scheduleId))
            errors["scheduleId"] = ["scheduleId is required."];
        if (string.IsNullOrWhiteSpace(monthRaw))
            errors["month"] = ["month is required (format YYYY-MM)."];
        if (errors.Count > 0)
            return req.ValidationError(errors);

        if (!TryParseMonth(monthRaw!, out var monthStart, out var monthEnd))
            return req.ValidationError("month", "month must be YYYY-MM (e.g. 2026-05).");

        var schedule = await _scheduleRepo.GetByIdAsync(scheduleId!, ct);
        if (schedule is null)
            return req.NotFound($"Schedule '{scheduleId}' not found.");

        // Q2: active enrollments for the schedule (single-partition).
        var (enrollments, _) = await _enrollmentRepo.SearchAsync(
            studentId: null,
            scheduleId: scheduleId,
            statuses: [Domain.Common.EnrollmentStatus.Active],
            includeInactive: false,
            limit: 500,
            offset: 0,
            ct);

        // Q3: last-payment-date per enrollment within the month.
        var enrollmentIds = enrollments.Select(e => e.Id).ToArray();
        var lastDates = await _repo.GetLastPaymentDatesAsync(enrollmentIds, monthStart, monthEnd, ct);

        var debtors = enrollments
            .Where(e => !lastDates.ContainsKey(e.Id))
            .Select(e => new DebtorRow(
                EnrollmentId: e.Id,
                StudentId: e.StudentId,
                StudentName: e.StudentName,
                StudentDoc: e.StudentDoc,
                LastPaymentDate: null))
            .ToList();

        return new OkObjectResult(new
        {
            scheduleId,
            scheduleName = schedule.Course + " · " + schedule.Level,
            month = monthRaw,
            debtors,
        });
    }

    // --- Helpers ---

    private static int ClampLimit(string? raw) =>
        Math.Clamp(ParseInt(raw, DefaultLimit), 1, MaxLimit);

    private static int ParseInt(string? raw, int fallback) =>
        int.TryParse(raw, out var v) ? v : fallback;

    private static bool ParseBool(string? raw) =>
        bool.TryParse(raw, out var v) && v;

    private static bool TryParseDate(string? raw, out DateOnly? date)
    {
        if (string.IsNullOrWhiteSpace(raw)) { date = null; return true; }
        if (DateOnly.TryParse(raw, out var d)) { date = d; return true; }
        date = null;
        return false;
    }

    private static bool TryParseMonth(string raw, out DateOnly start, out DateOnly end)
    {
        if (DateTime.TryParseExact(raw, "yyyy-MM", System.Globalization.CultureInfo.InvariantCulture,
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

    private static Dictionary<string, string[]> ValidateBasic(StudentPaymentWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.EnrollmentId))
            errors["enrollmentId"] = ["The enrollmentId field is required."];
        if (req.Date == default)
            errors["date"] = ["The date field is required."];
        if (req.Amount <= 0)
            errors["amount"] = ["amount must be greater than zero."];
        if (req.InstallmentNumber < 1)
            errors["installmentNumber"] = ["installmentNumber must be 1 or greater."];
        if (string.IsNullOrWhiteSpace(req.PaymentMethod))
            errors["paymentMethod"] = ["The paymentMethod field is required."];
        return errors;
    }

    private static void ApplyMutableFields(StudentPaymentWriteRequest req, StudentPayment target)
    {
        target.Date = req.Date;
        target.Amount = req.Amount;
        target.InstallmentNumber = req.InstallmentNumber;
        target.PaymentMethod = req.PaymentMethod!;
        target.HasReceipt = req.HasReceipt;
        target.ReceiptNumber = req.ReceiptNumber;
        target.Notes = req.Notes;
        if (req.Active is { } active)
            target.Active = active;
    }

    private sealed record StudentPaymentWriteRequest(
        string? EnrollmentId,
        DateOnly Date,
        decimal Amount,
        int InstallmentNumber,
        string? PaymentMethod,
        bool HasReceipt,
        string? ReceiptNumber,
        string? Notes,
        bool? Active);

    private sealed record DebtorRow(
        string EnrollmentId,
        string StudentId,
        string StudentName,
        string StudentDoc,
        DateOnly? LastPaymentDate);
}
