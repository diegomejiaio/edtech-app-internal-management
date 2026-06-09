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
/// Expense CRUD endpoints (M7) per <c>docs/04-api-design.md §5.8</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
/// <remarks>
/// Snapshot policy: per <c>docs/01-domain-model.md</c> §3.8, when an expense is imputed
/// to a Schedule the <c>scheduleName</c> is a <b>frozen snapshot</b> taken at create time.
/// PUT preserves the original snapshot even if the user re-points <c>scheduleId</c>; to
/// take a fresh snapshot, create a new Expense.
/// </remarks>
public sealed class ExpenseFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly ExpenseRepository _repo;
    private readonly ScheduleRepository _scheduleRepo;
    private readonly ILogger<ExpenseFunction> _logger;

    public ExpenseFunction(
        ExpenseRepository repo,
        ScheduleRepository scheduleRepo,
        ILogger<ExpenseFunction> logger)
    {
        _repo = repo;
        _scheduleRepo = scheduleRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/expenses — paginated list with optional from/to/category/scheduleId filters.</summary>
    [Function("ExpenseList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/expenses")] HttpRequest req,
        CancellationToken ct)
    {
        var search = req.Query["search"].FirstOrDefault();
        var category = req.Query["category"].FirstOrDefault();
        var scheduleId = req.Query["scheduleId"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        if (!TryParseDate(req.Query["from"].FirstOrDefault(), out var from))
            return req.ValidationError("from", "from must be ISO date YYYY-MM-DD.");
        if (!TryParseDate(req.Query["to"].FirstOrDefault(), out var to))
            return req.ValidationError("to", "to must be ISO date YYYY-MM-DD.");

        var (items, total) = await _repo.SearchAsync(search, from, to, category, scheduleId, includeInactive, limit, offset, ct);
        return new OkObjectResult(new Paginated<Expense>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/expenses/{id}.</summary>
    [Function("ExpenseGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/expenses/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var e = await _repo.GetByIdAsync(id, ct);
        return e is null
            ? req.NotFound($"Expense '{id}' not found.")
            : new OkObjectResult(e);
    }

    /// <summary>
    /// POST /api/v1/expenses — create. When <c>scheduleId</c> is provided, validates it
    /// exists+active and snapshots the schedule name (frozen).
    /// </summary>
    [Function("ExpenseCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/expenses")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<ExpenseWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        Schedule? schedule = null;
        if (!string.IsNullOrWhiteSpace(body.ScheduleId))
        {
            schedule = await _scheduleRepo.GetByIdAsync(body.ScheduleId!, ct);
            if (schedule is null)
                return req.ValidationError("scheduleId", $"Schedule '{body.ScheduleId}' does not exist or is inactive.");
        }

        var expense = new Expense
        {
            ScheduleId = schedule?.Id,
            ScheduleName = schedule is null ? null : SnapshotScheduleName(schedule),
        };
        ApplyMutableFields(body, expense);

        expense.Code = await ShortCodeGenerator.GenerateUniqueAsync(
            async (candidate, token) => await _repo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
            "GAS-",
            5,
            ct: ct);
        var created = await _repo.CreateAsync(expense, ct);
        return req.Created(created, $"v1/expenses/{created.Id}");
    }

    /// <summary>
    /// PUT /api/v1/expenses/{id} — full replace. Existing <c>scheduleId</c> + <c>scheduleName</c>
    /// snapshot are preserved as a unit (frozen). To re-point or clear the imputation, delete
    /// and recreate.
    /// </summary>
    [Function("ExpenseUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/expenses/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Expense '{id}' not found.");

        var body = await req.ReadFromJsonAsync<ExpenseWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = ValidateBasic(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        ApplyMutableFields(body, existing);

        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/expenses/{id} — soft delete.</summary>
    [Function("ExpenseDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/expenses/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Expense '{id}' not found.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    // --- Helpers ---

    private static string SnapshotScheduleName(Schedule s) =>
        $"{s.Course} · {s.Level} · {s.Weekdays} {s.StartTime:HH\\:mm}";

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

    private static Dictionary<string, string[]> ValidateBasic(ExpenseWriteRequest req)
    {
        var errors = new Dictionary<string, string[]>();
        if (req.Date == default)
            errors["date"] = ["The date field is required."];
        if (string.IsNullOrWhiteSpace(req.Category))
            errors["category"] = ["The category field is required."];
        if (string.IsNullOrWhiteSpace(req.Description))
            errors["description"] = ["The description field is required."];
        if (req.Amount <= 0)
            errors["amount"] = ["amount must be greater than zero."];
        if (string.IsNullOrWhiteSpace(req.PaymentMethod))
            errors["paymentMethod"] = ["The paymentMethod field is required."];
        return errors;
    }

    private static void ApplyMutableFields(ExpenseWriteRequest req, Expense target)
    {
        target.Date = req.Date;
        target.Category = req.Category!;
        target.Description = req.Description!;
        target.Amount = req.Amount;
        target.PaymentMethod = req.PaymentMethod!;
        target.Notes = req.Notes;
        if (req.Active is { } active)
            target.Active = active;
    }

    private sealed record ExpenseWriteRequest(
        DateOnly Date,
        string? Category,
        string? Description,
        decimal Amount,
        string? PaymentMethod,
        string? ScheduleId,
        string? Notes,
        bool? Active);
}
