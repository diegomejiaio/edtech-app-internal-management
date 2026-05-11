using System.Security.Claims;

namespace EspacioPro.Application.Abstractions;

/// <summary>
/// Validates a Clerk-issued JWT against the public JWKS endpoint.
/// Implementation in Infrastructure caches signing keys.
/// </summary>
public interface IClerkJwtValidator
{
    /// <summary>
    /// Validates the token and returns a <see cref="ClaimsPrincipal"/> on success.
    /// Throws <see cref="EspacioPro.Application.Common.UnauthorizedException"/> on failure.
    /// </summary>
    Task<ClaimsPrincipal> ValidateAsync(string token, CancellationToken ct = default);
}
