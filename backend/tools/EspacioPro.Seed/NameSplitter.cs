namespace EspacioPro.Seed;

/// <summary>
/// Splits a person's full name into first/last name halves using a simple heuristic:
/// the first whitespace-separated token is the first name; the rest is the last name.
/// For single-token names, the full string becomes the first name and last name is empty.
/// </summary>
internal static class NameSplitter
{
    public static (string First, string Last) Split(string fullName)
    {
        var trimmed = (fullName ?? string.Empty).Trim();
        if (trimmed.Length == 0) return (string.Empty, string.Empty);

        var idx = trimmed.IndexOf(' ');
        if (idx < 0) return (trimmed, string.Empty);

        return (trimmed[..idx], trimmed[(idx + 1)..].Trim());
    }
}
