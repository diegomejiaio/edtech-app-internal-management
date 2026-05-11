using System.Net;

namespace EspacioPro.Application.Common;

/// <summary>
/// Static builders for RFC 7807 Problem Details responses.
/// Canonical <c>type</c> URIs follow <c>docs/07-api-contract-cheatsheet.md</c> §6.3.
/// Returned as <c>application/problem+json</c>.
/// </summary>
public static class ProblemDetailsFactory
{
    public static ProblemDetailsResponse BadRequest(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.BadRequest, "Bad Request", ProblemTypes.BadRequest, detail, instance, correlationId);

    public static ProblemDetailsResponse Unauthorized(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.Unauthorized, "Unauthorized", ProblemTypes.Unauthorized, detail, instance, correlationId);

    public static ProblemDetailsResponse Forbidden(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.Forbidden, "Forbidden", ProblemTypes.Forbidden, detail, instance, correlationId);

    public static ProblemDetailsResponse NotFound(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.NotFound, "Resource not found", ProblemTypes.NotFound, detail, instance, correlationId);

    public static ProblemDetailsResponse Conflict(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.Conflict, "Conflict", ProblemTypes.Conflict, detail, instance, correlationId);

    public static ProblemDetailsResponse Duplicate(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.Conflict, "Duplicate resource", ProblemTypes.Duplicate, detail, instance, correlationId);

    public static ProblemDetailsResponse DependentRecords(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.Conflict, "Cannot delete: active dependents", ProblemTypes.DependentRecords, detail, instance, correlationId);

    public static ProblemDetailsResponse PreconditionFailed(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.PreconditionFailed, "If-Match etag mismatch", ProblemTypes.PreconditionFailed, detail, instance, correlationId);

    public static ProblemDetailsResponse Validation(
        IDictionary<string, string[]> errors,
        string? instance = null,
        string? correlationId = null,
        string detail = "See 'errors' for field-level details.") =>
        new()
        {
            Type = ProblemTypes.Validation,
            Title = "One or more validation errors occurred.",
            Status = (int)HttpStatusCode.UnprocessableEntity,
            Detail = detail,
            Instance = instance,
            CorrelationId = correlationId,
            Errors = errors
        };

    public static ProblemDetailsResponse Validation(string field, string message, string? instance = null, string? correlationId = null) =>
        Validation(
            new Dictionary<string, string[]> { [field] = [message] },
            instance,
            correlationId);

    public static ProblemDetailsResponse Internal(string detail, string? instance = null, string? correlationId = null) =>
        Build(HttpStatusCode.InternalServerError, "Internal server error", ProblemTypes.Internal, detail, instance, correlationId);

    private static ProblemDetailsResponse Build(
        HttpStatusCode status, string title, string type, string detail, string? instance, string? correlationId) =>
        new()
        {
            Type = type,
            Title = title,
            Status = (int)status,
            Detail = detail,
            Instance = instance,
            CorrelationId = correlationId
        };
}

