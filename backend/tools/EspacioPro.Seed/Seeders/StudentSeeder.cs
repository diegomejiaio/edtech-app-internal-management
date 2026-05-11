using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class StudentSeeder
{
    private readonly StudentRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<StudentSeeder> _logger;

    public StudentSeeder(StudentRepository repo, ExcelReader excel, SeedContext ctx, ILogger<StudentSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadStudents();
        var created = 0;
        foreach (var row in rows)
        {
            var (first, last) = NameSplitter.Split(row.FullName);
            var entity = new Student
            {
                FirstName = first,
                LastName = last,
                DocType = DocType.Dni,
                DocNumber = row.DocNumber,
                Phone = row.Phone,
                Email = row.Email,
                Source = row.Source,
                Notes = row.Notes,
            };
            var saved = await _repo.CreateAsync(entity, ct);
            _ctx.Students[row.ExcelId] = saved;
            created++;
        }
        _logger.LogInformation("  students: {Count}", created);
        return created;
    }
}
