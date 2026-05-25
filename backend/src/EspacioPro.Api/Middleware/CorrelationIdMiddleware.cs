using EspacioPro.Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Middleware;

/// <summary>
/// Accepts <c>x-correlation-id</c> from the client request, generates one if missing or
/// invalid, echoes it on the response, and adds it to the logger scope for structured logging.
/// Per <c>docs/04-api-design.md</c> decision #10 and <c>docs/07-api-contract-cheatsheet.md</c> §9.
/// Stores the id in <see cref="HttpContext.Items"/> under <see cref="ItemKey"/> so handlers
/// can attach it to ProblemDetails responses.
/// </summary>
/// <remarks>
/// Inbound headers are validated by <see cref="CorrelationIds.Sanitize"/> to prevent
/// log/header injection. Anything failing validation is silently replaced with a freshly
/// generated GUID so upstream proxies can still safely prepend tracing prefixes.
/// </remarks>
public sealed class CorrelationIdMiddleware : IFunctionsWorkerMiddleware
{
    public const string HeaderName = "x-correlation-id";
    public const string ItemKey = "correlationId";

    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(ILogger<CorrelationIdMiddleware> logger)
    {
        _logger = logger;
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext is null)
        {
            await next(context);
            return;
        }

        var inbound = httpContext.Request.Headers[HeaderName].FirstOrDefault();
        var correlationId = CorrelationIds.Sanitize(inbound) ?? Guid.NewGuid().ToString("D");

        httpContext.Items[ItemKey] = correlationId;

        // Echo on response.
        httpContext.Response.OnStarting(() =>
        {
            httpContext.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        // Add to logger scope so all downstream log entries include it.
        using (_logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
        {
            try
            {
                await next(context);
            }
            catch (OperationCanceledException) when (httpContext.RequestAborted.IsCancellationRequested)
            {
                // Client disconnected mid-flight (browser navigated away, React effect
                // cleanup, abort signal from TanStack Query, etc.). This is benign:
                // log at info level and return without re-throwing so the Functions
                // host doesn't record it as a 500. The response is already aborted.
                _logger.LogInformation(
                    "Request aborted by client for {FunctionName} (correlationId={CorrelationId})",
                    context.FunctionDefinition.Name,
                    correlationId);
            }
        }
    }
}
