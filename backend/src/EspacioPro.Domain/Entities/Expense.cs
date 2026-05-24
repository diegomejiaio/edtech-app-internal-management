using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// Expense entity. Container: <c>operations</c>, partition key: <c>/type</c> = "expense".
/// Per <c>docs/01-domain-model.md</c> §3.8.
/// </summary>
/// <remarks>
/// Optional imputation to a <see cref="ScheduleId"/>. When present, <see cref="ScheduleName"/>
/// is a <b>frozen snapshot</b> taken at creation time and is not refreshed on PUT.
/// </remarks>
public sealed class Expense : BaseEntity
{
    public override string Type => EntityTypes.Expense;

    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    /// <summary>Catalog code from <c>expenseCategories</c>. Stored verbatim.</summary>
    [JsonPropertyName("category")]
    public string Category { get; set; } = default!;

    [JsonPropertyName("description")]
    public string Description { get; set; } = default!;

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary>Catalog code from <c>paymentMethods</c>. Stored verbatim.</summary>
    [JsonPropertyName("paymentMethod")]
    public string PaymentMethod { get; set; } = default!;

    /// <summary>Optional imputation to a Schedule.</summary>
    [JsonPropertyName("scheduleId")]
    public string? ScheduleId { get; set; }

    /// <summary>Snapshot of schedule name at creation time. Frozen. Null when not imputed.</summary>
    [JsonPropertyName("scheduleName")]
    public string? ScheduleName { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    /// <summary>
    /// Server-computed accent-folded + lowercased projection of
    /// <c>description + category + scheduleName</c>. Used for
    /// <c>CONTAINS</c> search; never set by clients.
    /// </summary>
    [JsonPropertyName("searchText")]
    public string? SearchText { get; set; }
}
