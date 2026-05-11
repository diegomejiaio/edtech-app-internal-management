using System.Text.Json;
using System.Text.Json.Serialization;

namespace EspacioPro.Application.Common;

/// <summary>
/// Serializes <see cref="TimeOnly"/> as <c>HH:mm</c> (24-hour) per
/// <c>docs/07-api-contract-cheatsheet.md</c> §4. The default System.Text.Json
/// converter emits <c>HH:mm:ss[.fff]</c>, which would break wire-format expectations.
/// </summary>
public sealed class TimeOnlyHHmmJsonConverter : JsonConverter<TimeOnly>
{
    private const string Format = "HH:mm";

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (string.IsNullOrEmpty(raw))
            throw new JsonException("Time string is required.");

        // Accept HH:mm or HH:mm:ss inbound (defensive against clients that send seconds).
        if (TimeOnly.TryParseExact(raw, Format, out var hhmm))
            return hhmm;
        if (TimeOnly.TryParse(raw, out var any))
            return new TimeOnly(any.Hour, any.Minute);

        throw new JsonException($"Time '{raw}' is not in expected format HH:mm.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString(Format, System.Globalization.CultureInfo.InvariantCulture));
}
