using EspacioPro.Api.Middleware;
using EspacioPro.Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EspacioPro.Api.Common;

/// <summary>
/// HttpRequest extensions for ProblemDetails responses with the request's
/// <c>x-correlation-id</c> attached automatically.
/// </summary>
internal static class ProblemResults
{
    private const string ProblemContentType = "application/problem+json";

    public static string? CorrelationId(this HttpRequest req) =>
        req.HttpContext.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var v) ? v as string : null;

    public static ObjectResult Problem(ProblemDetailsResponse problem) =>
        new(problem) { StatusCode = problem.Status, ContentTypes = { ProblemContentType } };

    public static ObjectResult NotFound(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.NotFound(detail, req.Path, req.CorrelationId()));

    public static ObjectResult BadRequest(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.BadRequest(detail, req.Path, req.CorrelationId()));

    public static ObjectResult Conflict(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.Conflict(detail, req.Path, req.CorrelationId()));

    public static ObjectResult Duplicate(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.Duplicate(detail, req.Path, req.CorrelationId()));

    public static ObjectResult DependentRecords(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.DependentRecords(detail, req.Path, req.CorrelationId()));

    public static ObjectResult PreconditionFailed(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.PreconditionFailed(detail, req.Path, req.CorrelationId()));

    public static ObjectResult CapacityFull(this HttpRequest req, string detail) =>
        Problem(ProblemDetailsFactory.Conflict(detail, req.Path, req.CorrelationId()));

    public static ObjectResult ValidationError(this HttpRequest req, IDictionary<string, string[]> errors) =>
        Problem(ProblemDetailsFactory.Validation(errors, req.Path, req.CorrelationId()));

    public static ObjectResult ValidationError(this HttpRequest req, string field, string message) =>
        Problem(ProblemDetailsFactory.Validation(field, message, req.Path, req.CorrelationId()));

    /// <summary>Returns 201 with the created resource and a <c>Location</c> header.</summary>
    public static ObjectResult Created(this HttpRequest req, object value, string resourcePath)
    {
        req.HttpContext.Response.Headers.Location = $"/api/{resourcePath}";
        return new ObjectResult(value) { StatusCode = StatusCodes.Status201Created };
    }
}
