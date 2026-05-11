namespace EspacioPro.Domain.Common;

/// <summary>
/// Helpers for converting .NET enum values to their on-the-wire camelCase form,
/// matching the global <c>JsonStringEnumConverter(JsonNamingPolicy.CamelCase)</c>
/// registered in <c>Program.cs</c>.
/// </summary>
/// <remarks>
/// Cosmos DB queries that filter by enum-backed columns must compare against the
/// camelCase token actually stored, not the PascalCase .NET name. Use these helpers
/// in repository code instead of inline string juggling.
/// </remarks>
public static class EnumWire
{
    /// <summary>
    /// Returns the camelCase wire token for an enum value
    /// (e.g. <c>EnrollmentStatus.Active</c> → <c>"active"</c>,
    /// <c>ScheduleStatus.InProgress</c> → <c>"inProgress"</c>).
    /// </summary>
    public static string ToCamel<TEnum>(TEnum value) where TEnum : struct, Enum =>
        ToCamel(value.ToString());

    /// <summary>
    /// Lowercases the first character of a PascalCase string. Returns the input
    /// unchanged when empty or already lower-cased.
    /// </summary>
    public static string ToCamel(string pascal) =>
        string.IsNullOrEmpty(pascal) || char.IsLower(pascal[0])
            ? pascal
            : char.ToLowerInvariant(pascal[0]) + pascal[1..];
}
