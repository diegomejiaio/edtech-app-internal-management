using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// StudentPayment entity. Container: <c>operations</c>, partition key: <c>/type</c> = "studentPayment".
/// Per <c>docs/01-domain-model.md</c> §3.6.
/// </summary>
/// <remarks>
/// All snapshots (<see cref="StudentId"/>, <see cref="StudentName"/>, <see cref="ScheduleId"/>,
/// <see cref="ScheduleName"/>) are <b>frozen forever</b> at creation time — a payment is a
/// historical fact and must not change if the linked student or schedule is later edited.
/// PUT endpoints therefore preserve the original snapshots.
/// </remarks>
public sealed class StudentPayment : BaseEntity
{
    public override string Type => EntityTypes.StudentPayment;

    [JsonPropertyName("enrollmentId")]
    public string EnrollmentId { get; set; } = default!;

    /// <summary>Snapshot: student id at payment time. Frozen.</summary>
    [JsonPropertyName("studentId")]
    public string StudentId { get; set; } = default!;

    /// <summary>Snapshot: student full name at payment time. Frozen.</summary>
    [JsonPropertyName("studentName")]
    public string StudentName { get; set; } = default!;

    /// <summary>Snapshot: schedule id at payment time. Frozen.</summary>
    [JsonPropertyName("scheduleId")]
    public string ScheduleId { get; set; } = default!;

    /// <summary>Snapshot: schedule name at payment time. Frozen.</summary>
    [JsonPropertyName("scheduleName")]
    public string ScheduleName { get; set; } = default!;

    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary>Free, not auto-calculated. UI may warn on duplicates within an enrollment.</summary>
    [JsonPropertyName("installmentNumber")]
    public int InstallmentNumber { get; set; }

    /// <summary>Catalog code from <c>paymentMethods</c>. Stored verbatim.</summary>
    [JsonPropertyName("paymentMethod")]
    public string PaymentMethod { get; set; } = default!;

    [JsonPropertyName("hasReceipt")]
    public bool HasReceipt { get; set; }

    [JsonPropertyName("receiptNumber")]
    public string? ReceiptNumber { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
