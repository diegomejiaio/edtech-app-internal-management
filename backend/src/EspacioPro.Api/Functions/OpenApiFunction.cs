using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Serves the hand-authored OpenAPI 3.1 spec at <c>/api/v1/openapi.yaml</c> (raw)
/// and <c>/api/v1/openapi.json</c> (parsed and re-serialized).
/// </summary>
/// <remarks>
/// The spec is loaded once from <c>openapi.yaml</c> (copied to output directory) and
/// memoised per-format. Source of truth is the YAML file — JSON is a derived view
/// for tooling that prefers it (e.g. <c>openapi-typescript</c>).
/// See <c>docs/06-openapi-pipeline.md</c>.
/// </remarks>
public sealed class OpenApiFunction
{
    private const string SpecFileName = "openapi.yaml";

    private static readonly Lazy<string> YamlText = new(LoadYaml);
    private static readonly Lazy<string> JsonText = new(BuildJson);

    private readonly ILogger<OpenApiFunction> _logger;
    private readonly IHostEnvironment _env;

    public OpenApiFunction(ILogger<OpenApiFunction> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    /// <summary>GET /api/v1/openapi.yaml — raw YAML spec.</summary>
    [Function("OpenApiYaml")]
    public IActionResult Yaml(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/openapi.yaml")] HttpRequest req)
    {
        try
        {
            return new ContentResult
            {
                Content = YamlText.Value,
                ContentType = "application/yaml; charset=utf-8",
                StatusCode = StatusCodes.Status200OK
            };
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "openapi.yaml not found in app base directory.");
            return new NotFoundResult();
        }
    }

    /// <summary>GET /api/v1/openapi.json — YAML parsed and re-emitted as JSON.</summary>
    [Function("OpenApiJson")]
    public IActionResult Json(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/openapi.json")] HttpRequest req)
    {
        try
        {
            return new ContentResult
            {
                Content = JsonText.Value,
                ContentType = "application/json; charset=utf-8",
                StatusCode = StatusCodes.Status200OK
            };
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "openapi.yaml not found in app base directory.");
            return new NotFoundResult();
        }
    }

    private static string LoadYaml()
    {
        var path = Path.Combine(AppContext.BaseDirectory, SpecFileName);
        if (!File.Exists(path))
            throw new FileNotFoundException($"OpenAPI spec not found at {path}.", path);
        return File.ReadAllText(path, Encoding.UTF8);
    }

    private static string BuildJson()
    {
        var deserializer = new DeserializerBuilder().Build();
        var graph = deserializer.Deserialize<object?>(YamlText.Value);
        return JsonSerializer.Serialize(graph, new JsonSerializerOptions
        {
            WriteIndented = true,
        });
    }
}
