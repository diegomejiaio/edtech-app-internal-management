using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Schedules;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class ScheduleSeeder
{
    private readonly ScheduleRepository _repo;
    private readonly CatalogRepository _catalogRepo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ScheduleSeeder> _logger;

    public ScheduleSeeder(
        ScheduleRepository repo,
        CatalogRepository catalogRepo,
        ExcelReader excel,
        SeedContext ctx,
        ICurrentUser currentUser,
        ILogger<ScheduleSeeder> logger)
    {
        _repo = repo;
        _catalogRepo = catalogRepo;
        _excel = excel;
        _ctx = ctx;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>
    /// Maps the Excel "Dias" label (long Spanish form) to the canonical weekday
    /// catalog code (<c>weekdays</c> catalog: L, Ma, Mi, J, V, S, D, LMiV, MaJ, L-V, SD, ...).
    /// Unknown labels fall through verbatim — operator can fix them post-seed via the UI.
    /// </summary>
    private static string MapDays(string label) => label switch
    {
        "Lunes" => "L",
        "Martes" => "Ma",
        "Miércoles" => "Mi",
        "Jueves" => "J",
        "Viernes" => "V",
        "Lunes, Miércoles, Viernes" => "LMiV",
        "Martes, Jueves" => "MaJ",
        "Sábado" => "S",
        "Domingo" => "D",
        "Sábado, Domingo" => "SD",
        "Lunes a Viernes" => "L-V",
        _ => label,
    };

    private static ScheduleStatus MapStatus(string label) => label switch
    {
        "Activo" => ScheduleStatus.Active,
        "En progreso" => ScheduleStatus.InProgress,
        "Finalizado" => ScheduleStatus.Finished,
        "Cancelado" => ScheduleStatus.Cancelled,
        _ => throw new InvalidDataException($"Unknown schedule status: '{label}'"),
    };

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadSchedules();
        var courses = await _catalogRepo.GetByCodeAsync("courses", ct)
            ?? throw new InvalidDataException("Catalog 'courses' is required before seeding schedules.");
        var created = 0;
        foreach (var row in rows)
        {
            var teacher = _ctx.Teacher(row.TeacherExcelId);
            var entity = new Schedule
            {
                Course = row.Course,
                Level = row.Level,
                TeacherId = teacher.Id,
                TeacherName = $"{teacher.FirstName} {teacher.LastName}".Trim(),
                Weekdays = MapDays(row.DaysLabel),
                StartTime = row.StartTime,
                EndTime = row.EndTime,
                Price = row.Price,
                Capacity = row.Capacity,
                Status = MapStatus(row.Status),
                StartDate = row.StartDate,
            };
            if (!ScheduleDurationResolver.TryResolve(courses, entity.Course, entity.Level, out var durationHours))
                throw new InvalidDataException($"Missing duration metadata for '{entity.Course}' / '{entity.Level}'.");

            entity.CourseDurationHours = durationHours;
            entity.Sessions = [.. ScheduleSessionGenerator.Generate(entity, durationHours, _currentUser.GetAuditUser())];
            ScheduleSessionGenerator.ApplyProjection(entity);

            var saved = await _repo.CreateAsync(entity, ct);
            _ctx.Schedules[row.ExcelId] = saved;
            created++;
        }
        _logger.LogInformation("  schedules: {Count}", created);
        return created;
    }
}
