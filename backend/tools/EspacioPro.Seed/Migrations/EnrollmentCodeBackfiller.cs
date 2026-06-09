using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>INS-7Q3K9</c>) to enrollments missing one.</summary>
internal sealed class EnrollmentCodeBackfiller
{
    private const string Prefix = "INS-";
    private const int Length = 5;

    private readonly EnrollmentRepository _enrollmentRepo;
    private readonly ILogger<EnrollmentCodeBackfiller> _logger;

    public EnrollmentCodeBackfiller(
        EnrollmentRepository enrollmentRepo,
        ILogger<EnrollmentCodeBackfiller> logger)
    {
        _enrollmentRepo = enrollmentRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var enrollments = await _enrollmentRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var enrollment in enrollments)
        {
            if (!string.IsNullOrEmpty(enrollment.Code))
                continue;

            enrollment.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _enrollmentRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _enrollmentRepo.UpdateAsync(enrollment, ct);
            updated++;

            _logger.LogInformation("  enrollment '{Id}' code={Code}", enrollment.Id, enrollment.Code);
        }

        return (enrollments.Count, updated);
    }
}
