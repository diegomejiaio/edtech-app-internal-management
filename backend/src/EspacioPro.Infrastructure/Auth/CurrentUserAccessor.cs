using System.Security.Claims;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using Microsoft.AspNetCore.Http;

namespace EspacioPro.Infrastructure.Auth;

/// <summary>
/// Resolves the current user from the HTTP context's <see cref="ClaimsPrincipal"/>.
/// Maps Clerk JWT claims (sub, email, name) to an <see cref="AuditUser"/> snapshot.
/// </summary>
public sealed class CurrentUserAccessor : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public AuditUser? GetAuditUser()
    {
        var principal = _httpContextAccessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
            return null;

        var clerkUserId = principal.FindFirstValue("sub") ?? string.Empty;
        var email = principal.FindFirstValue("email")
                    ?? principal.FindFirstValue(ClaimTypes.Email)
                    ?? string.Empty;
        var displayName = principal.FindFirstValue("name")
                          ?? principal.FindFirstValue(ClaimTypes.Name)
                          ?? string.Empty;

        return new AuditUser(clerkUserId, email, displayName);
    }
}
