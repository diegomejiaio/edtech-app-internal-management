using System.Security.Claims;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using Microsoft.AspNetCore.Http;

namespace EspacioPro.Infrastructure.Auth;

/// <summary>
/// Resolves the current user from the HTTP context's <see cref="ClaimsPrincipal"/>.
/// Maps Clerk JWT claims (sub, email, name) to an <see cref="AuditUser"/> snapshot.
/// </summary>
/// <remarks>
/// When both <c>AZURE_FUNCTIONS_ENVIRONMENT=Development</c> and
/// <c>DEV_AUTH_BYPASS=true</c> are set, returns a synthetic admin user as a
/// fallback if no authenticated principal is present. This mirrors the
/// dev-bypass principal that <c>JwtAuthMiddleware</c> attempts to inject, and
/// guards against isolated-worker HttpContext propagation quirks where
/// <c>HttpContext.User</c> set by worker middleware is not visible via
/// <see cref="IHttpContextAccessor"/> during function execution.
/// Must NEVER be enabled in production.
/// </remarks>
public sealed class CurrentUserAccessor : ICurrentUser
{
    private static readonly AuditUser DevFallbackUser =
        new("user_dev", "dev@espaciopro.local", "Dev User");

    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public AuditUser? GetAuditUser()
    {
        var principal = _httpContextAccessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
        {
            return IsDevBypassEnabled() ? DevFallbackUser : null;
        }

        var clerkUserId = principal.FindFirstValue("sub") ?? string.Empty;
        var email = principal.FindFirstValue("email")
                    ?? principal.FindFirstValue(ClaimTypes.Email)
                    ?? string.Empty;
        var displayName = principal.FindFirstValue("name")
                          ?? principal.FindFirstValue(ClaimTypes.Name)
                          ?? string.Empty;

        return new AuditUser(clerkUserId, email, displayName);
    }

    private static bool IsDevBypassEnabled()
    {
        var envName = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT");
        var bypass = Environment.GetEnvironmentVariable("DEV_AUTH_BYPASS");
        return string.Equals(envName, "Development", StringComparison.OrdinalIgnoreCase)
               && string.Equals(bypass, "true", StringComparison.OrdinalIgnoreCase);
    }
}
