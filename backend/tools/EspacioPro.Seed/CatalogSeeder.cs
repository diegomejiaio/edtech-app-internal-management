using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed;

/// <summary>
/// Idempotent catalog seeder. Existing catalog codes are left untouched; missing ones
/// are created with their default item set per <c>docs/01-domain-model.md</c> §3.1.
/// </summary>
internal sealed class CatalogSeeder
{
    private readonly CatalogRepository _repo;
    private readonly ILogger<CatalogSeeder> _logger;

    public CatalogSeeder(CatalogRepository repo, ILogger<CatalogSeeder> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    /// <summary>
    /// Seed definitions per <c>docs/01-domain-model.md</c> §3.1.
    /// Note: <c>enrollmentStatuses</c> and <c>scheduleStatuses</c> are NOT catalogs (code-level enums).
    /// </summary>
    private static readonly IReadOnlyList<(string Code, string[] Items)> Defaults =
    [
        ("courses",            ["Melamina", "Drywall"]),
        ("levels",             ["Principiante", "Intermedio", "Profesional"]),
        ("paymentMethods",     ["Yape", "Transferencia", "Efectivo"]),
        ("expenseCategories",  ["Materiales", "Alquiler", "Marketing", "Servicios", "Equipos", "Otros"]),
        ("weekdays",           ["L", "M", "V", "S", "D", "LMV", "MJ", "L-V", "SD"]),
        ("studentSources",     ["Instagram", "Tiktok", "Referido", "Facebook"]),
    ];

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var created = 0;

        foreach (var (code, items) in Defaults)
        {
            var existing = await _repo.GetByCodeAsync(code, ct);
            if (existing is not null)
            {
                _logger.LogInformation("Skip {Code}: already exists ({Count} items).", code, existing.Items.Count);
                continue;
            }

            var catalog = new Catalog
            {
                Code = code,
                Items = [.. items.Select((value, idx) => new CatalogItem
                {
                    Value = value,
                    Order = idx + 1,
                    Active = true
                })]
            };

            await _repo.CreateAsync(catalog, ct);
            _logger.LogInformation("Created {Code} with {Count} items.", code, items.Length);
            created++;
        }

        return created;
    }
}
