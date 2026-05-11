using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

internal sealed class ExpenseSeeder
{
    private readonly ExpenseRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<ExpenseSeeder> _logger;

    public ExpenseSeeder(ExpenseRepository repo, ExcelReader excel, SeedContext ctx, ILogger<ExpenseSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadExpenses();
        var created = 0;
        foreach (var row in rows)
        {
            string? scheduleId = null;
            string? scheduleName = null;
            if (!string.IsNullOrWhiteSpace(row.ScheduleExcelId))
            {
                var sched = _ctx.Schedule(row.ScheduleExcelId);
                scheduleId = sched.Id;
                scheduleName = $"{sched.Course} · {sched.Level}";
            }

            var entity = new Expense
            {
                Date          = row.Date,
                Category      = row.Category,
                Description   = row.Description,
                Amount        = row.Amount,
                PaymentMethod = row.PaymentMethod,
                ScheduleId    = scheduleId,
                ScheduleName  = scheduleName,
                Notes         = row.Notes,
            };
            await _repo.CreateAsync(entity, ct);
            created++;
        }
        _logger.LogInformation("  expenses: {Count}", created);
        return created;
    }
}
