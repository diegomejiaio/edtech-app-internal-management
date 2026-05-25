using EspacioPro.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;

namespace EspacioPro.Api.Functions;

public sealed class CorsFunction
{
    private readonly string[] _allowedOrigins;

    public CorsFunction(IConfiguration configuration)
    {
        _allowedOrigins = CorsHeaders.ParseOrigins(configuration[CorsHeaders.OriginsConfigKey]);
    }

    [Function("CorsPreflight")]
    public IActionResult Preflight(
        [HttpTrigger(AuthorizationLevel.Anonymous, "options", Route = "{*path}")] HttpRequest req,
        string? path)
    {
        var allowedOrigin = CorsHeaders.ResolveAllowedOrigin(req, _allowedOrigins);
        if (allowedOrigin is not null)
        {
            CorsHeaders.Apply(req.HttpContext.Response, allowedOrigin);
        }

        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }
}
