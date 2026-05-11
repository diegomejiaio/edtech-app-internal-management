using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class ScheduleSeeder
{
    private readonly ScheduleRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<ScheduleSeeder> _logger;

    public ScheduleSeeder(ScheduleRepository repo, ExcelReader excel, SeedContext ctx, ILogger<ScheduleSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    /// <summary>
    /// Maps the Excel "Dias" label (long Spanish form) to the canonical weekday
    /// catalog code (<c>weekdays</c> catalog: L, M, V, S, D, LMV, MJ, L-V, SD, ...).
    /// Unknown labels fall through verbatim — operator can fix them post-seed via the UI.
    /// </summary>
    private static string MapDays(string label) => label switch
    {
        "Lunes, Miércoles, Viernes" => "LMV",
        "Martes, Jueves"            => "MJ",
        "Sábado"                    => "S",
        "Domingo"                   => "D",
        "Sábado, Domingo"           => "SD",
        "Lunes a Viernes"           => "L-V",
        _                           => label,
    };

    private static ScheduleStatus MapStatus(string label) => label switch
    {
        "Activo"      => ScheduleStatus.Active,
        "En progreso" => ScheduleStatus.InProgress,
        "Finalizado"  => ScheduleStatus.Finished,
        "Cancelado"   => ScheduleStatus.Cancelled,
        _             => throw new InvalidDataException($"Unknown schedule status: '{label}'"),
    };

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadSchedules();
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
            var saved = await _repo.CreateAsync(entity, ct);
            _ctx.Schedules[row.ExcelId] = saved;
            created++;
        }
        _logger.LogInformation("  schedules: {Count}", created);
        return created;
    }
}
