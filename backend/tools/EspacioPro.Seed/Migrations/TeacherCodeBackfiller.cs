using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>PRO-7Q3K9</c>) to teachers missing one.</summary>
internal sealed class TeacherCodeBackfiller
{
    private const string Prefix = "PRO-";
    private const int Length = 5;

    private readonly TeacherRepository _teacherRepo;
    private readonly ILogger<TeacherCodeBackfiller> _logger;

    public TeacherCodeBackfiller(
        TeacherRepository teacherRepo,
        ILogger<TeacherCodeBackfiller> logger)
    {
        _teacherRepo = teacherRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var teachers = await _teacherRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var teacher in teachers)
        {
            if (!string.IsNullOrEmpty(teacher.Code))
                continue;

            teacher.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _teacherRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _teacherRepo.UpdateAsync(teacher, ct);
            updated++;

            _logger.LogInformation("  teacher '{Id}' code={Code}", teacher.Id, teacher.Code);
        }

        return (teachers.Count, updated);
    }
}
