using System.Text.Json.Serialization;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Entities;

/// <summary>
/// A catalog document containing a list of configurable items.
/// One document per catalog code (e.g. "paymentMethods", "courses").
/// Container: <c>master</c>, partition key: <c>/type</c> = "catalog".
/// </summary>
public sealed class Catalog : BaseEntity
{
    public override string Type => EntityTypes.Catalog;

    /// <summary>Unique catalog identifier (e.g. "paymentMethods", "expenseCategories").</summary>
    [JsonPropertyName("code")]
    public string Code { get; set; } = default!;

    /// <summary>Inline array of catalog items.</summary>
    [JsonPropertyName("items")]
    public List<CatalogItem> Items { get; set; } = [];
}

/// <summary>
/// A single item inside a catalog document.
/// </summary>
public sealed class CatalogItem
{
    [JsonPropertyName("value")]
    public string Value { get; set; } = default!;

    [JsonPropertyName("order")]
    public int Order { get; set; }

    [JsonPropertyName("active")]
    public bool Active { get; set; } = true;
}
