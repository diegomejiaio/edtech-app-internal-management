using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Seed;

/// <summary>
/// Hard-deletes every document previously created by the seeder
/// (identified by <c>createdBy.email == "system@espaciopro.local"</c>) across both
/// the <c>master</c> and <c>operations</c> containers. Real-user data is left untouched.
/// <para>
/// <b>Why hard delete?</b> The <c>master</c> container has a unique-key constraint on
/// <c>/dedupKey</c>. Cosmos unique keys do <b>not</b> filter by <c>active</c>, so a
/// soft-deleted document still occupies its dedupKey slot and would block re-seeding
/// (a re-create with the same business key would fail with HTTP 409 Conflict).
/// <c>--reset</c> is a destructive seed-time operation, so hard delete is the correct
/// semantics here. The application's normal soft-delete path is untouched.
/// </para>
/// </summary>
internal sealed class SeedResetter
{
    private readonly Database _database;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<SeedResetter> _logger;

    public SeedResetter(
        CosmosClient client,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<SeedResetter> logger)
    {
        _database = client.GetDatabase(options.Value.Database);
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>
    /// Counts seed-marker documents (active or soft-deleted) across both containers.
    /// Used to drive idempotency before a destructive reset.
    /// </summary>
    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        var seedEmail = SeedMarker(_currentUser);
        var total = 0;
        foreach (var container in BothContainers())
            total += await CountInContainerAsync(container, seedEmail, ct);
        return total;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var seedEmail = SeedMarker(_currentUser);
        var deleted = 0;

        foreach (var container in BothContainers())
            deleted += await HardDeleteInContainerAsync(container, seedEmail, ct);

        _logger.LogInformation("Reset complete — hard-deleted {Count} document(s) across both containers.", deleted);
        return deleted;
    }

    private IEnumerable<Container> BothContainers()
    {
        yield return _database.GetContainer(ContainerNames.Master);
        yield return _database.GetContainer(ContainerNames.Operations);
    }

    private static string SeedMarker(ICurrentUser current) =>
        current.GetAuditUser()?.Email
        ?? throw new InvalidOperationException("Seed marker email is unavailable from current user.");

    private static async Task<int> CountInContainerAsync(Container container, string seedEmail, CancellationToken ct)
    {
        // No `active = true` filter — soft-deleted seed docs still hold their
        // unique-key slot and must be counted (and removed) too.
        var def = new QueryDefinition(
            "SELECT VALUE COUNT(1) FROM c WHERE c.createdBy.email = @email")
            .WithParameter("@email", seedEmail);
        var total = 0;
        using var iter = container.GetItemQueryIterator<int>(def);
        while (iter.HasMoreResults)
            total += (await iter.ReadNextAsync(ct)).Sum();
        return total;
    }

    private async Task<int> HardDeleteInContainerAsync(
        Container container,
        string seedEmail,
        CancellationToken ct)
    {
        // Pull (id, type) tuples for every doc the seeder ever created — including
        // already-soft-deleted ones — so we free up their dedupKey slots too.
        var def = new QueryDefinition(
            "SELECT c.id, c.type FROM c WHERE c.createdBy.email = @email")
            .WithParameter("@email", seedEmail);

        var targets = new List<(string Id, string Type)>();
        using (var iter = container.GetItemQueryIterator<Target>(def))
        {
            while (iter.HasMoreResults)
            {
                foreach (var t in await iter.ReadNextAsync(ct))
                    targets.Add((t.Id, t.Type));
            }
        }

        var deleted = 0;
        foreach (var (id, type) in targets)
        {
            await container.DeleteItemAsync<dynamic>(
                id,
                new PartitionKey(type),
                cancellationToken: ct);
            deleted++;
        }
        if (deleted > 0)
            _logger.LogInformation("  {Container}: hard-deleted {Count}", container.Id, deleted);
        return deleted;
    }

    private sealed record Target(string Id, string Type);
}
