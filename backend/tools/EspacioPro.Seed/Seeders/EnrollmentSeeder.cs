using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class EnrollmentSeeder
{
    private readonly EnrollmentRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<EnrollmentSeeder> _logger;

    public EnrollmentSeeder(EnrollmentRepository repo, ExcelReader excel, SeedContext ctx, ILogger<EnrollmentSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    private static EnrollmentStatus MapStatus(string label) => label switch
    {
        "Activo" => EnrollmentStatus.Active,
        "Completado" => EnrollmentStatus.Completed,
        "Cancelado" => EnrollmentStatus.Cancelled,
        "Pendiente" => EnrollmentStatus.Pending,
        _ => throw new InvalidDataException($"Unknown enrollment status: '{label}'"),
    };

    private static string DocLabel(Student s) => $"{s.DocType.ToString().ToUpperInvariant()} {s.DocNumber}";

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadEnrollments();
        var created = 0;
        foreach (var row in rows)
        {
            var student = _ctx.Student(row.StudentExcelId);
            var schedule = _ctx.Schedule(row.ScheduleExcelId);

            var entity = new Enrollment
            {
                StudentId = student.Id,
                StudentName = $"{student.FirstName} {student.LastName}".Trim(),
                StudentDoc = DocLabel(student),
                ScheduleId = schedule.Id,
                ScheduleName = row.ScheduleLabel, // preserve the human-friendly label from the source
                SchedulePrice = schedule.Price,
                EnrollmentDate = row.EnrollmentDate,
                Status = MapStatus(row.Status),
            };
            var saved = await _repo.CreateAsync(entity, ct);
            _ctx.Enrollments[row.ExcelId] = saved;
            created++;
        }
        _logger.LogInformation("  enrollments: {Count}", created);
        return created;
    }
}
