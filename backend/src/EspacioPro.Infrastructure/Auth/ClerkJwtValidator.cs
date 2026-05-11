using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Tokens;

namespace EspacioPro.Infrastructure.Auth;

/// <summary>
/// Validates Clerk JWTs using the public JWKS endpoint.
/// Signing keys are cached in-memory with a 1-hour TTL.
/// </summary>
public sealed class ClerkJwtValidator : IClerkJwtValidator
{
    private const string JwksCacheKey = "clerk_jwks_signing_keys";
    private static readonly TimeSpan JwksCacheTtl = TimeSpan.FromHours(1);

    private readonly ClerkOptions _options;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ClerkJwtValidator> _logger;
    private readonly HttpDocumentRetriever _documentRetriever;

    public ClerkJwtValidator(
        IOptions<ClerkOptions> options,
        IMemoryCache cache,
        ILogger<ClerkJwtValidator> logger)
    {
        _options = options.Value;
        _cache = cache;
        _logger = logger;

        // We fetch the raw JWKS document directly and parse it via
        // `new JsonWebKeySet(json)`. Using ConfigurationManager<T> would require
        // either an OIDC discovery URL (we have a JWKS URL) or a custom
        // IConfigurationRetriever — both are heavier than this two-line fetch
        // and we already cache the parsed keys in IMemoryCache.
        _documentRetriever = new HttpDocumentRetriever { RequireHttps = true };
    }

    public async Task<ClaimsPrincipal> ValidateAsync(string token, CancellationToken ct = default)
    {
        try
        {
            var signingKeys = await GetSigningKeysAsync(ct);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _options.Issuer,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = signingKeys,
                ClockSkew = TimeSpan.FromMinutes(2)
            };

            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, validationParameters, out _);

            _logger.LogDebug("JWT validated for subject {Subject}",
                principal.FindFirstValue("sub"));

            return principal;
        }
        catch (SecurityTokenException ex)
        {
            // Expected path for invalid/expired tokens — log a single line
            // (no stack trace) and let the middleware return 401.
            _logger.LogWarning("JWT validation failed: {Reason}", ex.Message);
            throw new UnauthorizedException("Invalid or expired token.", ex);
        }
    }

    private async Task<ICollection<SecurityKey>> GetSigningKeysAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(JwksCacheKey, out ICollection<SecurityKey>? cached) && cached is not null)
            return cached;

        _logger.LogInformation("Fetching JWKS from {JwksUrl}", _options.JwksUrl);

        var json = await _documentRetriever.GetDocumentAsync(_options.JwksUrl, ct);
        var jwks = new JsonWebKeySet(json);
        var keys = jwks.GetSigningKeys();

        _cache.Set(JwksCacheKey, keys, JwksCacheTtl);

        return keys;
    }
}
