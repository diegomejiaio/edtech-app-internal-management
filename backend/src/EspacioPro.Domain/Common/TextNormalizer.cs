using System.Globalization;
using System.Text;

namespace EspacioPro.Domain.Common;

/// <summary>
/// Text normalization helper for accent- and case-insensitive search.
///
/// Cosmos DB SQL has no built-in accent folding (<c>LOWER()</c> handles case
/// only). Searchable entities store a precomputed <c>searchText</c> field
/// produced by <see cref="Normalize"/>; queries normalize the user input the
/// same way and use <c>CONTAINS(c.searchText, @search)</c>.
/// </summary>
public static class TextNormalizer
{
    /// <summary>
    /// Returns the input lowercased and with combining diacritical marks
    /// removed (e.g. "José Andrés" → "jose andres"). Whitespace is preserved.
    /// </summary>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;

        var decomposed = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }

        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    /// <summary>
    /// Joins the given parts with single spaces and normalizes the result.
    /// Null or whitespace parts are skipped.
    /// </summary>
    public static string Compose(params string?[] parts)
    {
        var joined = string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return Normalize(joined);
    }

    /// <summary>
    /// Returns only the digit characters of the input (e.g. "+57 300-123 4567"
    /// → "573001234567"). Used to make phone numbers searchable regardless of
    /// formatting (spaces, dashes, parentheses, plus signs).
    /// </summary>
    public static string DigitsOnly(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var sb = new StringBuilder(input.Length);
        foreach (var ch in input)
        {
            if (char.IsDigit(ch)) sb.Append(ch);
        }
        return sb.ToString();
    }
}
