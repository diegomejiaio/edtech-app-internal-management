using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Configuration;

namespace EspacioPro.Api.Middleware;

public sealed class CorsMiddleware : IFunctionsWorkerMiddleware
{
    private readonly string[] _allowedOrigins;

    public CorsMiddleware(IConfiguration configuration)
    {
        _allowedOrigins = CorsHeaders.ParseOrigins(configuration[CorsHeaders.OriginsConfigKey]);
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext is null)
        {
            await next(context);
            return;
        }

        var allowedOrigin = CorsHeaders.ResolveAllowedOrigin(httpContext.Request, _allowedOrigins);
        if (allowedOrigin is not null)
        {
            httpContext.Response.OnStarting(() =>
            {
                CorsHeaders.Apply(httpContext.Response, allowedOrigin);
                return Task.CompletedTask;
            });
        }

        await next(context);
    }
}
