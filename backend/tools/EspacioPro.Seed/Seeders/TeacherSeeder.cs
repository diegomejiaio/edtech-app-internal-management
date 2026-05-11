using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class TeacherSeeder
{
    private readonly TeacherRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<TeacherSeeder> _logger;

    public TeacherSeeder(TeacherRepository repo, ExcelReader excel, SeedContext ctx, ILogger<TeacherSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadTeachers();
        var created = 0;
        foreach (var row in rows)
        {
            var (first, last) = NameSplitter.Split(row.FullName);
            var entity = new Teacher
            {
                FirstName = first,
                LastName = last,
                DocType = DocType.Dni,
                DocNumber = row.DocNumber,
                Phone = row.Phone,
                Email = row.Email,
                Specialty = row.Specialty,
                ClerkUserId = null,
            };
            var saved = await _repo.CreateAsync(entity, ct);
            _ctx.Teachers[row.ExcelId] = saved;
            created++;
        }
        _logger.LogInformation("  teachers: {Count}", created);
        return created;
    }
}
