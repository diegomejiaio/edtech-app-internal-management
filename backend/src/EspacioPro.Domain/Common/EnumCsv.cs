namespace EspacioPro.Domain.Common;

/// <summary>
/// Helpers for parsing comma-separated enum filters coming from query strings
/// (e.g. <c>?status=active,inProgress</c>).
/// </summary>
/// <remarks>
/// Kept in the domain layer (like <see cref="EnumWire"/>) so it can be unit-tested
/// without referencing the Functions host. Function code should delegate its
/// <c>status</c> query-param parsing here instead of juggling <c>Enum.TryParse</c> inline.
/// </remarks>
public static class EnumCsv
{
    /// <summary>
    /// Parses a comma-separated list of enum tokens (case-insensitive) into a distinct list,
    /// preserving input order. Empty/whitespace input yields an empty list and returns
    /// <see langword="true"/> (meaning "no filter"). Returns <see langword="false"/> as soon
    /// as any token fails to parse.
    /// </summary>
    public static bool TryParse<TEnum>(string? raw, out List<TEnum> values)
        where TEnum : struct, Enum
    {
        values = [];
        if (string.IsNullOrWhiteSpace(raw))
            return true;

        foreach (var token in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Enum.TryParse<TEnum>(token, ignoreCase: true, out var parsed))
                return false;
            if (!values.Contains(parsed))
                values.Add(parsed);
        }
        return true;
    }
}
