using System.Text.Json;
using EspacioPro.Domain.Entities;

namespace EspacioPro.Application.Schedules;

/// <summary>Resolves course/level duration metadata from catalog items.</summary>
public static class ScheduleDurationResolver
{
    private const string DurationHoursByLevelKey = "durationHoursByLevel";

    public static bool TryResolve(
        Catalog courses,
        string course,
        string level,
        out decimal durationHours)
    {
        durationHours = 0m;

        var courseItem = courses.Items.FirstOrDefault(i =>
            i.Active && i.Value.Equals(course, StringComparison.OrdinalIgnoreCase));
        if (courseItem?.Metadata is null)
            return false;

        if (!courseItem.Metadata.TryGetValue(DurationHoursByLevelKey, out var raw) || raw is null)
            return false;

        if (raw is JsonElement element)
            return TryReadDurationFromElement(element, level, out durationHours);

        if (raw is IReadOnlyDictionary<string, object?> map)
            return TryReadDurationFromObjectMap(map, level, out durationHours);

        return false;
    }

    private static bool TryReadDurationFromElement(JsonElement element, string level, out decimal durationHours)
    {
        durationHours = 0m;
        if (element.ValueKind != JsonValueKind.Object)
            return false;

        foreach (var prop in element.EnumerateObject())
        {
            if (!prop.Name.Equals(level, StringComparison.OrdinalIgnoreCase))
                continue;

            if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDecimal(out var value) && value > 0)
            {
                durationHours = value;
                return true;
            }
        }

        return false;
    }

    private static bool TryReadDurationFromObjectMap(
        IReadOnlyDictionary<string, object?> map,
        string level,
        out decimal durationHours)
    {
        durationHours = 0m;
        foreach (var (key, value) in map)
        {
            if (!key.Equals(level, StringComparison.OrdinalIgnoreCase) || value is null)
                continue;

            if (value is decimal decimalValue && decimalValue > 0)
            {
                durationHours = decimalValue;
                return true;
            }
            if (value is int intValue && intValue > 0)
            {
                durationHours = intValue;
                return true;
            }
            if (value is double doubleValue && doubleValue > 0)
            {
                durationHours = (decimal)doubleValue;
                return true;
            }
            if (decimal.TryParse(value.ToString(), out var parsed) && parsed > 0)
            {
                durationHours = parsed;
                return true;
            }
        }

        return false;
    }
}

