using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

/// <summary>
/// Seeds <see cref="Catalog"/> documents from the "Datos Maestros" sheet.
/// Catalogs <c>enrollmentStatuses</c> and <c>scheduleStatuses</c> are intentionally
/// skipped — they map to code-level enums (<c>EnrollmentStatus</c>, <c>ScheduleStatus</c>).
/// </summary>
internal sealed class CatalogSeeder
{
    private readonly CatalogRepository _repo;
    private readonly ExcelReader _excel;
    private readonly ILogger<CatalogSeeder> _logger;

    public CatalogSeeder(CatalogRepository repo, ExcelReader excel, ILogger<CatalogSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadCatalogs();
        var created = 0;

        foreach (var c in rows)
        {
            var catalog = new Catalog
            {
                Code = c.Code,
                Items = [.. c.Items.Select((value, idx) => new CatalogItem
                {
                    Value = value,
                    Order = idx + 1,
                    Active = true,
                })],
            };
            await _repo.CreateAsync(catalog, ct);
            _logger.LogInformation("  catalog '{Code}' ({Count} items)", c.Code, c.Items.Count);
            created++;
        }

        return created;
    }
}
