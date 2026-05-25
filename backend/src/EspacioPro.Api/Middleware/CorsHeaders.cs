using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace EspacioPro.Api.Middleware;

internal static class CorsHeaders
{
    public const string OriginsConfigKey = "CORS_ORIGINS";

    private const string AllowOrigin = "Access-Control-Allow-Origin";
    private const string AllowMethods = "Access-Control-Allow-Methods";
    private const string AllowHeaders = "Access-Control-Allow-Headers";
    private const string ExposeHeaders = "Access-Control-Expose-Headers";
    private const string MaxAge = "Access-Control-Max-Age";
    private const string Vary = "Vary";

    public static string[] ParseOrigins(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    public static string? ResolveAllowedOrigin(HttpRequest request, IReadOnlyCollection<string> allowedOrigins)
    {
        var origin = request.Headers.Origin.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(origin))
        {
            return null;
        }

        return allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
            ? origin
            : null;
    }

    public static void Apply(HttpResponse response, string origin)
    {
        response.Headers[AllowOrigin] = origin;
        response.Headers[AllowMethods] = "GET,POST,PUT,DELETE,OPTIONS";
        response.Headers[AllowHeaders] = "authorization,content-type,x-correlation-id,if-match";
        response.Headers[ExposeHeaders] = "x-correlation-id,etag,location";
        response.Headers[MaxAge] = "3600";
        AppendVaryOrigin(response.Headers);
    }

    private static void AppendVaryOrigin(IHeaderDictionary headers)
    {
        headers[Vary] = "Origin";
    }
}
