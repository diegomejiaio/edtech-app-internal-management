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

/// <summary>
/// Stores the authenticated user snapshot for the current request scope.
/// Only authentication middleware should set this value.
/// </summary>
public interface ICurrentUserContext
{
    void SetAuditUser(AuditUser user);

    void Clear();
}
