using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>PAG-7Q3K9</c>) to student payments missing one.</summary>
internal sealed class StudentPaymentCodeBackfiller
{
    private const string Prefix = "PAG-";
    private const int Length = 5;

    private readonly StudentPaymentRepository _paymentRepo;
    private readonly ILogger<StudentPaymentCodeBackfiller> _logger;

    public StudentPaymentCodeBackfiller(
        StudentPaymentRepository paymentRepo,
        ILogger<StudentPaymentCodeBackfiller> logger)
    {
        _paymentRepo = paymentRepo;
        _logger = logger;
    }

    public async Task<(int Scanned, int Updated)> RunAsync(CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetAllAsync(includeInactive: true, ct);
        var updated = 0;

        foreach (var payment in payments)
        {
            if (!string.IsNullOrEmpty(payment.Code))
                continue;

            payment.Code = await ShortCodeGenerator.GenerateUniqueAsync(
                async (candidate, token) => await _paymentRepo.GetByCodeAsync(candidate, includeInactive: true, token) is not null,
                Prefix,
                Length,
                ct: ct);

            await _paymentRepo.UpdateAsync(payment, ct);
            updated++;

            _logger.LogInformation("  studentPayment '{Id}' code={Code}", payment.Id, payment.Code);
        }

        return (payments.Count, updated);
    }
}
