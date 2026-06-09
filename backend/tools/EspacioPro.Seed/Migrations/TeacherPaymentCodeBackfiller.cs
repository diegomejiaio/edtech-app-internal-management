using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Migrations;

/// <summary>Idempotently assigns a short business <c>code</c> (e.g. <c>PTP-7Q3K9</c>) to teacher payments missing one.</summary>
internal sealed class TeacherPaymentCodeBackfiller
{
    private const string Prefix = "PTP-";
    private const int Length = 5;

    private readonly TeacherPaymentRepository _paymentRepo;
    private readonly ILogger<TeacherPaymentCodeBackfiller> _logger;

    public TeacherPaymentCodeBackfiller(
        TeacherPaymentRepository paymentRepo,
        ILogger<TeacherPaymentCodeBackfiller> logger)
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

            _logger.LogInformation("  teacherPayment '{Id}' code={Code}", payment.Id, payment.Code);
        }

        return (payments.Count, updated);
    }
}
