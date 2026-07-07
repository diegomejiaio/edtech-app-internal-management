using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using System.Text.Json.Serialization;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Student CRUD endpoints (M3) per <c>docs/04-api-design.md §5.2</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
/// <remarks>
/// Doc drift note: <c>docs/01-domain-model.md</c> §3.2 says POST should "return existing"
/// when (docType,docNumber) collision, but <c>docs/04-api-design.md</c> §5.2 says 409.
/// We follow api-design (REST-correct + matches Cosmos unique-key behavior + matches Teacher).
/// </remarks>
public sealed class StudentFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly StudentRepository _repo;
    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly StudentPaymentRepository _paymentRepo;
    private readonly ILogger<StudentFunction> _logger;

    public StudentFunction(
        StudentRepository repo,
        EnrollmentRepository enrollmentRepo,
        StudentPaymentRepository paymentRepo,
        ILogger<StudentFunction> logger)
    {
        _repo = repo;
        _enrollmentRepo = enrollmentRepo;
        _paymentRepo = paymentRepo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/students — paginated list with optional search/docType/source filter.</summary>
    [Function("StudentList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/students")] HttpRequest req,
        CancellationToken ct)
    {
        var search = req.Query["search"].FirstOrDefault();
        var source = req.Query["source"].FirstOrDefault();
        var docTypeRaw = req.Query["docType"].FirstOrDefault();
        var includeInactive = ParseBool(req.Query["includeInactive"].FirstOrDefault());
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        DocType? docType = null;
        if (!string.IsNullOrWhiteSpace(docTypeRaw))
        {
            if (!Enum.TryParse<DocType>(docTypeRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("docType", "docType must be one of: dni, ce, passport.");
            docType = parsed;
        }

        var (items, total) = await _repo.SearchAsync(search, docType, source, includeInactive, limit, offset, ct);
        var studentIds = items.Select(student => student.Id).ToArray();

        var activeEnrollmentCountsTask = _enrollmentRepo.GetActiveCountsByStudentAsync(studentIds, ct);
        var lastPaymentDatesTask = _paymentRepo.GetLastPaymentDatesByStudentAsync(studentIds, ct);
        var totalPaidAmountsTask = _paymentRepo.GetTotalPaidAmountsByStudentAsync(studentIds, ct);
        await Task.WhenAll(activeEnrollmentCountsTask, lastPaymentDatesTask, totalPaidAmountsTask);

        var activeEnrollmentCounts = activeEnrollmentCountsTask.Result;
        var lastPaymentDates = lastPaymentDatesTask.Result;
        var totalPaidAmounts = totalPaidAmountsTask.Result;

        var responseItems = items
            .Select(student => StudentListItemResponse.From(
                student,
                activeEnrollmentCounts.GetValueOrDefault(student.Id),
                lastPaymentDates.TryGetValue(student.Id, out var lastPaymentDate) ? lastPaymentDate : null,
                totalPaidAmounts.GetValueOrDefault(student.Id)))
            .ToArray();

        return new OkObjectResult(new Paginated<StudentListItemResponse>(responseItems, total, limit, offset));
    }

    /// <summary>
    /// GET /api/v1/students/{id}.
    /// Per api-design §5.2 the response should include derived <c>enrollmentCount</c> and
    /// <c>lastPaymentDate</c>. Those depend on Enrollment (M5) and StudentPayment (M6) which
    /// are not yet implemented, so they are omitted in v1 of this endpoint.
    /// </summary>
    [Function("StudentGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/students/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var student = await _repo.GetByIdAsync(id, ct);
        return student is null
            ? req.NotFound($"Student '{id}' not found.")
            : new OkObjectResult(student);
    }

    /// <summary>POST /api/v1/students — create. 409 if (docType, docNumber) already active.</summary>
    [Function("StudentCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/students")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<StudentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var existing = await _repo.GetByDocAsync(body.DocType, body.DocNumber!, ct);
        if (existing is not null)
            return req.Duplicate(
                $"A student with {body.DocType.ToString().ToLowerInvariant()} {body.DocNumber} already exists.");

        var student = MapToEntity(body, new Student());
        student.Code = await ShortCodeGenerator.GenerateUniqueAsync(
            async (candidate, token) => await _repo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
            "EST-",
            5,
            ct: ct);
        var created = await _repo.CreateAsync(student, ct);

        return req.Created(created, $"v1/students/{created.Id}");
    }

    /// <summary>PUT /api/v1/students/{id} — full replace.</summary>
    [Function("StudentUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/students/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Student '{id}' not found.");

        var body = await req.ReadFromJsonAsync<StudentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        // Dedup against another student.
        var dup = await _repo.GetByDocAsync(body.DocType, body.DocNumber!, ct);
        if (dup is not null && !string.Equals(dup.Id, id, StringComparison.Ordinal))
            return req.Duplicate(
                $"Another student with {body.DocType.ToString().ToLowerInvariant()} {body.DocNumber} already exists.");

        MapToEntity(body, existing);
        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/students/{id} — soft delete. Returns 204.</summary>
    /// <remarks>
    /// Returns 409 <c>dependent-records</c> if the student has any active enrollments
    /// (api-design §5.2).
    /// </remarks>
    [Function("StudentDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/students/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Student '{id}' not found.");

        var activeEnrollments = await _enrollmentRepo.CountActiveByStudentAsync(id, ct);
        if (activeEnrollments > 0)
            return req.DependentRecords(
                $"Cannot delete student '{id}': {activeEnrollments} active enrollment(s) exist.");

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

    private static Dictionary<string, string[]> Validate(StudentWriteRequest req)
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

    private static Student MapToEntity(StudentWriteRequest req, Student target)
    {
        target.FirstName = req.FirstName!.Trim();
        target.LastName = req.LastName!.Trim();
        target.DocType = req.DocType;
        target.DocNumber = req.DocNumber!.Trim();
        target.Phone = req.Phone?.Trim();
        target.Email = req.Email?.Trim();
        target.Source = req.Source?.Trim();
        target.Notes = req.Notes?.Trim();
        if (req.Active is { } active)
            target.Active = active;
        return target;
    }

    private sealed record StudentListItemResponse(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("active")] bool Active,
        [property: JsonPropertyName("createdAt")] string CreatedAt,
        [property: JsonPropertyName("createdBy")] AuditUser? CreatedBy,
        [property: JsonPropertyName("updatedAt")] string UpdatedAt,
        [property: JsonPropertyName("updatedBy")] AuditUser? UpdatedBy,
        [property: JsonPropertyName("deletedAt")] string? DeletedAt,
        [property: JsonPropertyName("deletedBy")] AuditUser? DeletedBy,
        [property: JsonPropertyName("_etag")] string? ETag,
        [property: JsonPropertyName("code")] string? Code,
        [property: JsonPropertyName("firstName")] string FirstName,
        [property: JsonPropertyName("lastName")] string LastName,
        [property: JsonPropertyName("docType")] DocType DocType,
        [property: JsonPropertyName("docNumber")] string DocNumber,
        [property: JsonPropertyName("phone")] string? Phone,
        [property: JsonPropertyName("email")] string? Email,
        [property: JsonPropertyName("source")] string? Source,
        [property: JsonPropertyName("notes")] string? Notes,
        [property: JsonPropertyName("enrollmentCount")] int EnrollmentCount,
        [property: JsonPropertyName("lastPaymentDate")] string? LastPaymentDate,
        [property: JsonPropertyName("totalPaidAmount")] decimal TotalPaidAmount)
    {
        public static StudentListItemResponse From(
            Student student,
            int enrollmentCount,
            DateOnly? lastPaymentDate,
            decimal totalPaidAmount) =>
            new(
                student.Id,
                student.Type,
                student.Active,
                student.CreatedAt,
                student.CreatedBy,
                student.UpdatedAt,
                student.UpdatedBy,
                student.DeletedAt,
                student.DeletedBy,
                student.ETag,
                student.Code,
                student.FirstName,
                student.LastName,
                student.DocType,
                student.DocNumber,
                student.Phone,
                student.Email,
                student.Source,
                student.Notes,
                enrollmentCount,
                lastPaymentDate?.ToString("yyyy-MM-dd"),
                totalPaidAmount);
    }

    private sealed record StudentWriteRequest(
        string? FirstName,
        string? LastName,
        DocType DocType,
        string? DocNumber,
        string? Phone,
        string? Email,
        string? Source,
        string? Notes,
        bool? Active);
}
