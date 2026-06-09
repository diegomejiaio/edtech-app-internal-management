using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>GAS-7Q3K9</c>) to expenses missing one.</summary>
internal sealed class ExpenseCodeBackfiller
{
    private const string Prefix = "GAS-";
    private const int Length = 5;

    private readonly ExpenseRepository _expenseRepo;
    private readonly ILogger<ExpenseCodeBackfiller> _logger;

    public ExpenseCodeBackfiller(
        ExpenseRepository expenseRepo,
        ILogger<ExpenseCodeBackfiller> logger)
    {
        _expenseRepo = expenseRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var expenses = await _expenseRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var expense in expenses)
        {
            if (!string.IsNullOrEmpty(expense.Code))
                continue;

            expense.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _expenseRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _expenseRepo.UpdateAsync(expense, ct);
            updated++;

            _logger.LogInformation("  expense '{Id}' code={Code}", expense.Id, expense.Code);
        }

        return (expenses.Count, updated);
    }
}
