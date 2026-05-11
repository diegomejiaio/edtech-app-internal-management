using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// TeacherPayment entity. Container: <c>operations</c>, partition key: <c>/type</c> = "teacherPayment".
/// Per <c>docs/01-domain-model.md</c> §3.7.
/// </summary>
/// <remarks>
/// No FK to Schedule (decision inherited from the legacy GAS system).
/// <see cref="TeacherName"/> and <see cref="TeacherDoc"/> are <b>frozen forever</b> at creation
/// time — the payment is a historical record. PUT endpoints preserve the original snapshots.
/// </remarks>
public sealed class TeacherPayment : BaseEntity
{
    public override string Type => EntityTypes.TeacherPayment;

    [JsonPropertyName("teacherId")]
    public string TeacherId { get; set; } = default!;

    /// <summary>Snapshot: teacher full name at payment time. Frozen.</summary>
    [JsonPropertyName("teacherName")]
    public string TeacherName { get; set; } = default!;

    /// <summary>Snapshot: e.g. "DNI 12345678". Frozen.</summary>
    [JsonPropertyName("teacherDoc")]
    public string TeacherDoc { get; set; } = default!;

    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary>Free-text label (e.g. "Honorarios mayo", "Bono"). Required.</summary>
    [JsonPropertyName("concept")]
    public string Concept { get; set; } = default!;

    /// <summary>Catalog code from <c>paymentMethods</c>. Stored verbatim.</summary>
    [JsonPropertyName("paymentMethod")]
    public string PaymentMethod { get; set; } = default!;

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
