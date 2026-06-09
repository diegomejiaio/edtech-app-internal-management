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
/// TeacherPayment CRUD endpoints (M6) per <c>docs/04-api-design.md §5.7</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
/// <remarks>
/// Snapshot policy: per <c>docs/01-domain-model.md</c> §3.7, <c>teacherName</c> and
/// <c>teacherDoc</c> are <b>frozen forever</b> at create time. PUT preserves the originals.
/// </remarks>
public sealed class TeacherPaymentFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly TeacherPaymentRepository _repo;
    private readonly TeacherRepository _teacherRepo;
    private readonly ILogger<TeacherPaymentFunction> _logger;

    public TeacherPaymentFunction(
        TeacherPaymentRepository repo,
        TeacherRepository teacherRepo,
        ILogger<TeacherPaymentFunction> logger)
    {
        _repo = repo;
        _teacherRepo = teacherRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/teacher-payments — paginated list with optional teacherId/from/to filters.</summary>
    [Function("TeacherPaymentList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teacher-payments")] HttpRequest req,
        CancellationToken ct)
    {
        var teacherId = req.Query["teacherId"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        if (!TryParseDate(req.Query["from"].FirstOrDefault(), out var from))
            return req.ValidationError("from", "from must be ISO date YYYY-MM-DD.");
        if (!TryParseDate(req.Query["to"].FirstOrDefault(), out var to))
            return req.ValidationError("to", "to must be ISO date YYYY-MM-DD.");

        var (items, total) = await _repo.SearchAsync(teacherId, from, to, includeInactive, limit, offset, ct);
        return new OkObjectResult(new Paginated<TeacherPayment>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/teacher-payments/{id}.</summary>
    [Function("TeacherPaymentGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/teacher-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var p = await _repo.GetByIdAsync(id, ct);
        return p is null
            ? req.NotFound($"TeacherPayment '{id}' not found.")
            : new OkObjectResult(p);
    }

    /// <summary>
    /// POST /api/v1/teacher-payments — create. Validates teacher exists+active and
    /// snapshots <c>teacherName</c> + <c>teacherDoc</c> (frozen forever).
    /// </summary>
    [Function("TeacherPaymentCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/teacher-payments")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<TeacherPaymentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var teacher = await _teacherRepo.GetByIdAsync(body.TeacherId!, ct);
        if (teacher is null || !teacher.Active)
            return req.ValidationError("teacherId", $"Teacher '{body.TeacherId}' does not exist or is inactive.");

        var payment = new TeacherPayment
        {
            TeacherId = teacher.Id,
            TeacherName = $"{teacher.FirstName} {teacher.LastName}".Trim(),
            TeacherDoc = $"{teacher.DocType.ToString().ToUpperInvariant()} {teacher.DocNumber}",
        };
        ApplyMutableFields(body, payment);

        payment.Code = await ShortCodeGenerator.GenerateUniqueAsync(
            async (candidate, token) => await _repo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
            "PTP-",
            5,
            ct: ct);
        var created = await _repo.CreateAsync(payment, ct);
        return req.Created(created, $"v1/teacher-payments/{created.Id}");
    }

    /// <summary>
    /// PUT /api/v1/teacher-payments/{id} — full replace. <c>teacherId</c> + snapshots are preserved.
    /// </summary>
    [Function("TeacherPaymentUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/teacher-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"TeacherPayment '{id}' not found.");

        var body = await req.ReadFromJsonAsync<TeacherPaymentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        ApplyMutableFields(body, existing);

        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/teacher-payments/{id} — soft delete.</summary>
    [Function("TeacherPaymentDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/teacher-payments/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"TeacherPayment '{id}' not found.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
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

    private static Dictionary<string, string[]> ValidateBasic(TeacherPaymentWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.TeacherId))
            errors["teacherId"] = ["The teacherId field is required."];
        if (req.Date == default)
            errors["date"] = ["The date field is required."];
        if (req.Amount <= 0)
            errors["amount"] = ["amount must be greater than zero."];
        if (string.IsNullOrWhiteSpace(req.Concept))
            errors["concept"] = ["The concept field is required."];
        if (string.IsNullOrWhiteSpace(req.PaymentMethod))
            errors["paymentMethod"] = ["The paymentMethod field is required."];
        return errors;
    }

    private static void ApplyMutableFields(TeacherPaymentWriteRequest req, TeacherPayment target)
    {
        target.Date = req.Date;
        target.Amount = req.Amount;
        target.Concept = req.Concept!;
        target.PaymentMethod = req.PaymentMethod!;
        target.Notes = req.Notes;
        if (req.Active is { } active)
            target.Active = active;
    }

    private sealed record TeacherPaymentWriteRequest(
        string? TeacherId,
        DateOnly Date,
        decimal Amount,
        string? Concept,
        string? PaymentMethod,
        string? Notes,
        bool? Active);
}
