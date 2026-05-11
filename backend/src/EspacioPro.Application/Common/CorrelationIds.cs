using System.Text.RegularExpressions;

namespace EspacioPro.Application.Common;

/// <summary>
/// Helpers for the <c>x-correlation-id</c> request header. Per
/// <c>docs/04-api-design.md</c> decision #10 and <c>docs/07-api-contract-cheatsheet.md</c> §9.
/// </summary>
public static partial class CorrelationIds
{
    /// <summary>Maximum accepted length for an inbound correlation id.</summary>
    public const int MaxLength = 128;

    /// <summary>
    /// Returns the inbound id when it is non-empty, within <see cref="MaxLength"/>, and
    /// matches <c>[A-Za-z0-9._-]+</c>; otherwise returns <c>null</c> so the caller can
    /// substitute a freshly-generated identifier. This blocks header / log injection
    /// without rejecting requests that arrive through proxies adding tracing prefixes.
    /// </summary>
    public static string? Sanitize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (value.Length > MaxLength) return null;
        return AllowedCharsRegex().IsMatch(value) ? value : null;
    }

    [GeneratedRegex("^[A-Za-z0-9._-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex AllowedCharsRegex();
}
