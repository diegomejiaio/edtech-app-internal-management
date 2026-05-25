using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Common;

/// <summary>
/// Read model for schedule enrollment rows with backend-derived payment balance.
/// </summary>
public sealed record ScheduleEnrollmentResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = default!;

    [JsonPropertyName("studentId")]
    public string StudentId { get; init; } = default!;

    [JsonPropertyName("studentName")]
    public string StudentName { get; init; } = default!;

    [JsonPropertyName("status")]
    public EnrollmentStatus Status { get; init; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; init; }

    [JsonPropertyName("paidAmount")]
    public decimal PaidAmount { get; init; }

    [JsonPropertyName("pendingAmount")]
    public decimal PendingAmount { get; init; }

    public static ScheduleEnrollmentResponse From(Enrollment enrollment, decimal paidAmount)
    {
        var amount = enrollment.SchedulePrice;
        var pendingAmount = Math.Max(amount - paidAmount, 0m);

        return new ScheduleEnrollmentResponse
        {
            Id = enrollment.Id,
            StudentId = enrollment.StudentId,
            StudentName = enrollment.StudentName,
            Status = enrollment.Status,
            Amount = amount,
            PaidAmount = paidAmount,
            PendingAmount = pendingAmount,
        };
    }
}
