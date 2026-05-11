using System.Reflection;

namespace EspacioPro.Application.Health;

/// <summary>
/// Returns basic health information for the <c>/api/v1/health</c> endpoint.
/// </summary>
public sealed class HealthService
{
    public HealthResponse GetHealth() => new()
    {
        Status = "healthy",
        Version = Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "0.0.0",
        Timestamp = DateTime.UtcNow.ToString("o")
    };
}

public sealed class HealthResponse
{
    public string Status { get; init; } = default!;
    public string Version { get; init; } = default!;
    public string Timestamp { get; init; } = default!;
}
