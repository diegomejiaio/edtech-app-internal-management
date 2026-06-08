using System.Collections.Concurrent;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using EspacioPro.Api.Attributes;
using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Common;
using EspacioPro.Infrastructure.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Middleware;

/// <summary>
/// Functions worker middleware that validates Clerk JWTs on protected endpoints.
/// Skips functions without <see cref="RequireRoleAttribute"/>; enforces Bearer
/// token + role claim on functions that carry it.
/// </summary>
public sealed class JwtAuthMiddleware : IFunctionsWorkerMiddleware
{
    private const string BearerPrefix = "Bearer ";

    private readonly IClerkJwtValidator _jwtValidator;
    private readonly ILogger<JwtAuthMiddleware> _logger;

    // Cache reflected RequireRoleAttribute per entry point to avoid repeated reflection.
    private static readonly ConcurrentDictionary<string, RequireRoleAttribute?> RoleAttributeCache = new();

    public JwtAuthMiddleware(IClerkJwtValidator jwtValidator, ILogger<JwtAuthMiddleware> logger)
    {
        _jwtValidator = jwtValidator;
        _logger = logger;
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext is null)
        {
            // Non-HTTP trigger (timer, queue, etc.) — pass through.
            await next(context);
            return;
        }

        var roleAttr = ResolveRequireRole(context);

        // No [RequireRole] → anonymous endpoint; pass through.
        if (roleAttr is null)
        {
            await next(context);
            return;
        }

        // Dev-only auth bypass. Requires BOTH:
        //   AZURE_FUNCTIONS_ENVIRONMENT=Development  (Functions host's env name)
        //   DEV_AUTH_BYPASS=true                     (explicit opt-in)
        // Injects a synthetic admin principal so endpoints can be hit from
        // curl/Postman without a Clerk token. Never trust either flag in prod.
        if (IsDevBypassEnabled())
        {
            _logger.LogWarning(
                "⚠️ DEV_AUTH_BYPASS active: synthetic admin principal injected for {Function}. " +
                "This must NEVER be enabled in production.",
                context.FunctionDefinition.Name);
            var principal = BuildDevPrincipal(roleAttr.Role);
            httpContext.User = principal;
            await InvokeWithCurrentUserAsync(context, principal, next);
            return;
        }

        // Extract Bearer token.
        var authHeader = httpContext.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Missing or malformed Authorization header on {Function}",
                context.FunctionDefinition.Name);
            await WriteProblemAsync(httpContext, StatusCodes.Status401Unauthorized,
                "Missing or malformed Authorization header. Expected: Bearer <token>.");
            return;
        }

        var token = authHeader[BearerPrefix.Length..].Trim();

        // Validate JWT via Clerk JWKS.
        ClaimsPrincipal principal;
        try
        {
            principal = await _jwtValidator.ValidateAsync(token, context.CancellationToken);
        }
        catch (UnauthorizedException ex)
        {
            // Already logged with reason inside the validator — keep this line
            // structured but stack-trace free; 401 is an expected client error.
            _logger.LogWarning("Returning 401 on {Function}: {Reason}",
                context.FunctionDefinition.Name, ex.Message);
            await WriteProblemAsync(httpContext, StatusCodes.Status401Unauthorized, ex.Message);
            return;
        }

        // Check required role claim.
        // Clerk Organizations (JWT v2) puts the org role under the nested
        // `o` claim (e.g. {"id":"org_...","rol":"admin","slg":"..."}).
        // We read `o.rol` first; if not present we fall back to a flat
        // `role` claim for non-org tokens or future template overrides.
        var roleClaim = ResolveRole(principal);
        if (!string.Equals(roleClaim, roleAttr.Role, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Role mismatch on {Function}: required={Required}, actual={Actual}",
                context.FunctionDefinition.Name, roleAttr.Role, roleClaim ?? "(none)");
            await WriteProblemAsync(httpContext, StatusCodes.Status403Forbidden,
                $"Role '{roleAttr.Role}' is required. Your role: '{roleClaim ?? "(none)"}'.");
            return;
        }

        // Set principal on HttpContext so downstream code (ICurrentUser) can read it.
        httpContext.User = principal;

        await InvokeWithCurrentUserAsync(context, principal, next);
    }

    /// <summary>
    /// Resolves <see cref="RequireRoleAttribute"/> from the function's target method via reflection.
    /// Result is cached per entry point string.
    /// </summary>
    private static RequireRoleAttribute? ResolveRequireRole(FunctionContext context)
    {
        var entryPoint = context.FunctionDefinition.EntryPoint;

        return RoleAttributeCache.GetOrAdd(entryPoint, static ep =>
        {
            var lastDot = ep.LastIndexOf('.');
            if (lastDot < 0) return null;

            var typeName = ep[..lastDot];
            var methodName = ep[(lastDot + 1)..];

            var type = AppDomain.CurrentDomain.GetAssemblies()
                .Select(a =>
                {
                    try { return a.GetType(typeName); }
                    catch { return null; }
                })
                .FirstOrDefault(t => t is not null);

            if (type is null) return null;

            var method = type.GetMethod(methodName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
            return method?.GetCustomAttribute<RequireRoleAttribute>();
        });
    }

    /// <summary>
    /// Extracts the active role from a Clerk principal. Prefers the
    /// organization role embedded in the nested <c>o</c> claim
    /// (Clerk Organizations, JWT v2); falls back to a flat <c>role</c>
    /// claim if the token has one.
    /// </summary>
    private static string? ResolveRole(ClaimsPrincipal principal)
    {
        var orgClaim = principal.FindFirstValue("o");
        if (!string.IsNullOrEmpty(orgClaim))
        {
            try
            {
                using var doc = JsonDocument.Parse(orgClaim);
                if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                    doc.RootElement.TryGetProperty("rol", out var rolEl) &&
                    rolEl.ValueKind == JsonValueKind.String)
                {
                    return rolEl.GetString();
                }
            }
            catch (JsonException)
            {
                // `o` claim is not a JSON object — fall through to flat claim.
            }
        }

        return principal.FindFirstValue("role");
    }

    private static async Task WriteProblemAsync(HttpContext httpContext, int statusCode, string detail)
    {
        var correlationId = httpContext.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var v)
            ? v as string
            : null;

        var problem = statusCode == StatusCodes.Status401Unauthorized
            ? ProblemDetailsFactory.Unauthorized(detail, httpContext.Request.Path, correlationId)
            : ProblemDetailsFactory.Forbidden(detail, httpContext.Request.Path, correlationId);

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(problem);
    }

    private static async Task InvokeWithCurrentUserAsync(
        FunctionContext context,
        ClaimsPrincipal principal,
        FunctionExecutionDelegate next)
    {
        var currentUser = context.InstanceServices.GetRequiredService<ICurrentUserContext>();
        currentUser.SetAuditUser(CurrentUserAccessor.FromPrincipal(principal));
        try
        {
            await next(context);
        }
        finally
        {
            currentUser.Clear();
        }
    }

    /// <summary>
    /// True only when running locally with both env flags explicitly set.
    /// Both checks are required: env name guards against accidental flag
    /// leakage to a deployed environment, opt-in flag guards against the
    /// default dev workflow.
    /// </summary>
    private static bool IsDevBypassEnabled()
    {
        var envName = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT");
        var bypass = Environment.GetEnvironmentVariable("DEV_AUTH_BYPASS");
        return string.Equals(envName, "Development", StringComparison.OrdinalIgnoreCase)
               && string.Equals(bypass, "true", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Builds a synthetic <see cref="ClaimsPrincipal"/> for dev bypass.
    /// Mirrors the shape <see cref="ResolveRole"/> expects (nested <c>o.rol</c>)
    /// plus the <c>sub</c>/<c>email</c>/<c>name</c> claims that
    /// <c>CurrentUserAccessor</c> reads for audit fields.
    /// </summary>
    private static ClaimsPrincipal BuildDevPrincipal(string role)
    {
        var orgClaim = JsonSerializer.Serialize(new { id = "org_dev", rol = role });
        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim("sub", "user_dev"),
                new Claim("email", "dev@espaciopro.local"),
                new Claim("name", "Dev User"),
                new Claim("o", orgClaim),
            },
            authenticationType: "DevBypass");
        return new ClaimsPrincipal(identity);
    }
}
