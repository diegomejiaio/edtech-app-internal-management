using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>HOR-7Q3K9</c>) to schedules missing one.</summary>
internal sealed class ScheduleCodeBackfiller
{
    private const string Prefix = "HOR-";
    private const int Length = 5;

    private readonly ScheduleRepository _scheduleRepo;
    private readonly ILogger<ScheduleCodeBackfiller> _logger;

    public ScheduleCodeBackfiller(
        ScheduleRepository scheduleRepo,
        ILogger<ScheduleCodeBackfiller> logger)
    {
        _scheduleRepo = scheduleRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var schedules = await _scheduleRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var schedule in schedules)
        {
            if (!string.IsNullOrEmpty(schedule.Code))
                continue;

            schedule.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _scheduleRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _scheduleRepo.UpdateAsync(schedule, ct);
            updated++;

            _logger.LogInformation("  schedule '{Id}' code={Code}", schedule.Id, schedule.Code);
        }

        return (schedules.Count, updated);
    }
}
