using System.Net.Http.Headers;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Speech;

/// <summary>
/// Transcribes short audio clips (Telegram voice notes) to text using the Azure AI
/// Speech fast-transcription API on the shared AIServices account. Authentication is
/// keyless via the Function's managed identity (Cognitive Services User role); no
/// model deployment is required.
/// </summary>
public sealed class SpeechTranscriber
{
    private const string ApiVersion = "2024-11-15";
    private static readonly string[] Scopes = ["https://cognitiveservices.azure.com/.default"];

    private readonly HttpClient _http;
    private readonly ILogger<SpeechTranscriber> _logger;
    private readonly string? _endpoint;
    private readonly string _locale;
    private readonly TokenCredential _credential = new DefaultAzureCredential();

    public SpeechTranscriber(HttpClient http, IConfiguration config, ILogger<SpeechTranscriber> logger)
    {
        _http = http;
        _logger = logger;
        _endpoint = config["COGNITIVE_ENDPOINT"]?.TrimEnd('/');
        _locale = config["SPEECH_LOCALE"] ?? "es-ES";
    }

    /// <summary>Returns the transcribed text, or null if transcription was not possible.</summary>
    public async Task<string?> TranscribeAsync(byte[] audio, string fileName, string contentType, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_endpoint))
        {
            _logger.LogWarning("COGNITIVE_ENDPOINT not configured; cannot transcribe audio.");
            return null;
        }

        try
        {
            var token = await _credential.GetTokenAsync(new TokenRequestContext(Scopes), ct);

            using var content = new MultipartFormDataContent();

            var audioContent = new ByteArrayContent(audio);
            audioContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(audioContent, "audio", fileName);

            var definition = new StringContent(
                JsonSerializer.Serialize(new { locales = new[] { _locale } }));
            definition.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            content.Add(definition, "definition");

            var url = $"{_endpoint}/speechtotext/transcriptions:transcribe?api-version={ApiVersion}";
            using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            using var resp = await _http.SendAsync(request, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogError("Speech transcription failed: {Status} {Body}", (int)resp.StatusCode, body);
                return null;
            }

            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("combinedPhrases", out var phrases)
                && phrases.ValueKind == JsonValueKind.Array
                && phrases.GetArrayLength() > 0
                && phrases[0].TryGetProperty("text", out var text))
            {
                return text.GetString();
            }

            _logger.LogWarning("Speech transcription returned no phrases.");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during speech transcription.");
            return null;
        }
    }
}
