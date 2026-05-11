namespace EspacioPro.Application.Common;

/// <summary>
/// Standard pagination envelope per <c>docs/07-api-contract-cheatsheet.md</c> §8.
/// </summary>
public sealed record Paginated<T>(IReadOnlyList<T> Items, int Total, int Limit, int Offset);
