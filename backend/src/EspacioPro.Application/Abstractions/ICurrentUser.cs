using EspacioPro.Domain.Common;

namespace EspacioPro.Application.Abstractions;

/// <summary>
/// Resolves the current authenticated user from the request context.
/// Implementation reads claims from the validated JWT principal.
/// </summary>
public interface ICurrentUser
{
    /// <summary>
    /// Builds an <see cref="AuditUser"/> snapshot from the current request's claims.
    /// Returns null when no authenticated user is available (anonymous endpoints).
    /// </summary>
    AuditUser? GetAuditUser();
}
