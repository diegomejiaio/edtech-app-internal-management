using EspacioPro.Application.Health;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Health check endpoint. Anonymous — no JWT required.
/// </summary>
public sealed class HealthFunction
{
    private readonly HealthService _healthService;

    public HealthFunction(HealthService healthService)
    {
        _healthService = healthService;
    }

    [Function("Health")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/health")] HttpRequest req)
    {
        var health = _healthService.GetHealth();
        return new OkObjectResult(health);
    }
}
