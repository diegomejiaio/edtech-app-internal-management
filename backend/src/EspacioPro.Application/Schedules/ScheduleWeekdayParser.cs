namespace EspacioPro.Application.Schedules;

/// <summary>Parses schedule weekday catalog codes into .NET weekday values.</summary>
public static class ScheduleWeekdayParser
{
    private static readonly IReadOnlyDictionary<string, DayOfWeek[]> Patterns =
        new Dictionary<string, DayOfWeek[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["L"] = [DayOfWeek.Monday],
            ["Ma"] = [DayOfWeek.Tuesday],
            ["Mi"] = [DayOfWeek.Wednesday],
            ["J"] = [DayOfWeek.Thursday],
            ["V"] = [DayOfWeek.Friday],
            ["S"] = [DayOfWeek.Saturday],
            ["D"] = [DayOfWeek.Sunday],
            ["LMiV"] = [DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday],
            ["MaJ"] = [DayOfWeek.Tuesday, DayOfWeek.Thursday],
            ["L-V"] = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday],
            ["SD"] = [DayOfWeek.Saturday, DayOfWeek.Sunday],
            // Legacy parser-only aliases.
            ["M"] = [DayOfWeek.Tuesday],
            ["LMV"] = [DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday],
            ["MJ"] = [DayOfWeek.Tuesday, DayOfWeek.Thursday],
        };

    public static IReadOnlySet<string> CanonicalCodes { get; } =
        new HashSet<string>(["L", "Ma", "Mi", "J", "V", "S", "D", "LMiV", "MaJ", "L-V", "SD"]);

    public static bool TryParse(string? code, out IReadOnlySet<DayOfWeek> weekdays)
    {
        weekdays = new HashSet<DayOfWeek>();
        if (string.IsNullOrWhiteSpace(code))
            return false;

        if (!Patterns.TryGetValue(code.Trim(), out var days))
            return false;

        weekdays = days.ToHashSet();
        return true;
    }

    public static string CanonicalListForMessage() =>
        string.Join(", ", CanonicalCodes.OrderBy(code => code, StringComparer.Ordinal));
}
