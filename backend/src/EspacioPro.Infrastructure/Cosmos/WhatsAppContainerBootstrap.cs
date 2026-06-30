using EspacioPro.Domain.Common;
using Microsoft.Azure.Cosmos;

namespace EspacioPro.Infrastructure.Cosmos;

/// <summary>
/// Ensures the <c>whatsapp</c> container exists. The container is newer than
/// <c>master</c>/<c>operations</c> and may not be provisioned in <c>espaciopro-dev</c>,
/// so WhatsApp repositories call <see cref="EnsureAsync"/> once before their first
/// write/query. Runs at most once per process; no-op when the container already exists.
/// </summary>
public static class WhatsAppContainerBootstrap
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static bool _ready;

    public static async Task EnsureAsync(CosmosClient client, string databaseName, CancellationToken ct = default)
    {
        if (_ready) return;
        await Gate.WaitAsync(ct);
        try
        {
            if (_ready) return;
            var database = client.GetDatabase(databaseName);
            await database.CreateContainerIfNotExistsAsync(
                new ContainerProperties(ContainerNames.WhatsApp, "/type"),
                cancellationToken: ct);
            _ready = true;
        }
        finally
        {
            Gate.Release();
        }
    }
}
