using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Schedules;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently generates missing schedule sessions for existing schedules.</summary>
internal sealed class ScheduleSessionBackfiller
{
    private readonly ScheduleRepository _scheduleRepo;
    private readonly CatalogRepository _catalogRepo;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ScheduleSessionBackfiller> _logger;

    public ScheduleSessionBackfiller(
        ScheduleRepository scheduleRepo,
        CatalogRepository catalogRepo,
        ICurrentUser currentUser,
        ILogger<ScheduleSessionBackfiller> logger)
    {
        _scheduleRepo = scheduleRepo;
        _catalogRepo = catalogRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var courses = await _catalogRepo.GetByCodeAsync("courses", ct)
            ?? throw new InvalidDataException("Catalog 'courses' is required before backfilling schedule sessions.");
        var schedules = await _scheduleRepo.GetAllAsync(includeInactive: false, ct);
        var updated = 0;

        foreach (var schedule in schedules)
        {
            if (schedule.Sessions.Any(s => s.Active))
                continue;

            if (!ScheduleDurationResolver.TryResolve(courses, schedule.Course, schedule.Level, out var durationHours))
                throw new InvalidDataException($"Missing duration metadata for '{schedule.Course}' / '{schedule.Level}'.");

            schedule.CourseDurationHours = durationHours;
            schedule.Sessions = [.. ScheduleSessionGenerator.Generate(schedule, durationHours, _currentUser.GetAuditUser())];
            ScheduleSessionGenerator.ApplyProjection(schedule);
            await _scheduleRepo.UpdateAsync(schedule, ct);
            updated++;

            _logger.LogInformation("  schedule '{Id}' sessions={Count}", schedule.Id, schedule.Sessions.Count);
        }

        return (schedules.Count, updated);
    }
}

