namespace EspacioPro.Application.Common;

/// <summary>
/// Thrown when JWT validation fails (invalid signature, expired, bad issuer, etc.).
/// Middleware catches this and returns 401.
/// </summary>
public sealed class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
    public UnauthorizedException(string message, Exception innerException)
        : base(message, innerException) { }
}
