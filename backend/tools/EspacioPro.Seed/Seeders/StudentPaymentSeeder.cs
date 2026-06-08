using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed.Excel;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

/// <summary>
/// Seeds <see cref="StudentPayment"/> documents from the "Pagos" sheet.
/// Snapshots (<c>studentId</c>, <c>scheduleId</c>, names) are derived from the
/// already-imported <see cref="Enrollment"/> referenced by the source row.
/// </summary>
internal sealed class StudentPaymentSeeder
{
    private readonly StudentPaymentRepository _repo;
    private readonly ExcelReader _excel;
    private readonly SeedContext _ctx;
    private readonly ILogger<StudentPaymentSeeder> _logger;

    public StudentPaymentSeeder(
        StudentPaymentRepository repo,
        ExcelReader excel,
        SeedContext ctx,
        ILogger<StudentPaymentSeeder> logger)
    {
        _repo = repo;
        _excel = excel;
        _ctx = ctx;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var rows = _excel.ReadPayments();
        var created = 0;
        foreach (var row in rows)
        {
            var enrollment = _ctx.Enrollment(row.EnrollmentExcelId);

            var entity = new StudentPayment
            {
                EnrollmentId = enrollment.Id,
                StudentId = enrollment.StudentId,
                StudentName = enrollment.StudentName,
                ScheduleId = enrollment.ScheduleId,
                ScheduleName = enrollment.ScheduleName,
                Date = row.Date,
                Amount = row.Amount,
                InstallmentNumber = row.InstallmentNumber,
                PaymentMethod = row.PaymentMethod,
                HasReceipt = row.HasReceipt,
                ReceiptNumber = row.ReceiptNumber,
                Notes = row.Notes,
            };
            await _repo.CreateAsync(entity, ct);
            created++;
        }
        _logger.LogInformation("  studentPayments: {Count}", created);
        return created;
    }
}
