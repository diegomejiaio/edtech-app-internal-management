using System.Security.Cryptography;

namespace EspacioPro.Domain.Common;

/// <summary>
/// Generates short, human-friendly, hard-to-confuse unique codes (e.g. <c>HOR-7Q3K9</c>).
/// Reusable across entities that need a readable business code distinct from the GUID <c>id</c>.
/// </summary>
/// <remarks>
/// Uses the Crockford Base32 alphabet (digits + uppercase letters excluding
/// <c>I</c>, <c>L</c>, <c>O</c>, <c>U</c>) to avoid visual/typing ambiguity.
/// Characters are drawn with a cryptographically strong RNG and rejection
/// sampling, so the distribution is unbiased.
/// </remarks>
public static class ShortCodeGenerator
{
    /// <summary>Crockford Base32 alphabet (32 chars, excludes I, L, O, U).</summary>
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    /// <summary>
    /// Generates a single code as <paramref name="prefix"/> + <paramref name="length"/>
    /// random Crockford Base32 characters (e.g. <c>HOR-7Q3K9</c>).
    /// </summary>
    /// <param name="prefix">Optional human-readable prefix (e.g. <c>"HOR-"</c>). May be empty.</param>
    /// <param name="length">Number of random characters to append. Must be positive.</param>
    public static string Generate(string prefix, int length)
    {
        ArgumentNullException.ThrowIfNull(prefix);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(length);

        return string.Create(prefix.Length + length, (prefix, length), static (span, state) =>
        {
            var (p, len) = state;
            p.AsSpan().CopyTo(span);
            for (var i = 0; i < len; i++)
                span[p.Length + i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        });
    }

    /// <summary>
    /// Generates a code that is unique according to <paramref name="exists"/>, retrying on
    /// collision up to <paramref name="maxAttempts"/> times.
    /// </summary>
    /// <param name="exists">
    /// Predicate that returns <c>true</c> when a candidate code is already taken
    /// (e.g. a repository lookup including soft-deleted documents).
    /// </param>
    /// <param name="prefix">Human-readable prefix (e.g. <c>"HOR-"</c>).</param>
    /// <param name="length">Number of random characters to append.</param>
    /// <param name="maxAttempts">Maximum collision retries before giving up. Defaults to 8.</param>
    /// <exception cref="InvalidOperationException">No unique code was found within <paramref name="maxAttempts"/>.</exception>
    public static async Task<string> GenerateUniqueAsync(
        Func<string, CancellationToken, Task<bool>> exists,
        string prefix,
        int length,
        int maxAttempts = 8,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(exists);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxAttempts);

        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            var candidate = Generate(prefix, length);
            if (!await exists(candidate, ct))
                return candidate;
        }

        throw new InvalidOperationException(
            $"Could not generate a unique code with prefix '{prefix}' after {maxAttempts} attempts.");
    }
}
