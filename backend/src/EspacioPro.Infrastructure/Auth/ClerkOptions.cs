namespace EspacioPro.Infrastructure.Auth;

/// <summary>
/// Configuration options bound from app settings for Clerk JWT validation.
/// </summary>
public sealed class ClerkOptions
{
    public const string SectionName = "Clerk";

    /// <summary>Clerk's public JWKS endpoint URL.</summary>
    public string JwksUrl { get; set; } = default!;

    /// <summary>Expected issuer claim in JWTs.</summary>
    public string Issuer { get; set; } = default!;
}
