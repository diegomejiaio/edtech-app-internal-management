using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>EST-7Q3K9</c>) to students missing one.</summary>
internal sealed class StudentCodeBackfiller
{
    private const string Prefix = "EST-";
    private const int Length = 5;

    private readonly StudentRepository _studentRepo;
    private readonly ILogger<StudentCodeBackfiller> _logger;

    public StudentCodeBackfiller(
        StudentRepository studentRepo,
        ILogger<StudentCodeBackfiller> logger)
    {
        _studentRepo = studentRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var students = await _studentRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var student in students)
        {
            if (!string.IsNullOrEmpty(student.Code))
                continue;

            student.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _studentRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _studentRepo.UpdateAsync(student, ct);
            updated++;

            _logger.LogInformation("  student '{Id}' code={Code}", student.Id, student.Code);
        }

        return (students.Count, updated);
    }
}
