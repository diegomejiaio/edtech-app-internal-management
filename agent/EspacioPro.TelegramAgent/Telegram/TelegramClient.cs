using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Telegram;

/// <summary>
/// Thin client over the Telegram Bot API. PoC only needs <c>sendMessage</c>.
/// </summary>
public sealed class TelegramClient
{
    private readonly HttpClient _http;
    private readonly ILogger<TelegramClient> _logger;
    private readonly string _token;

    public TelegramClient(HttpClient http, IConfiguration config, ILogger<TelegramClient> logger)
    {
        _http = http;
        _logger = logger;
        _token = config["TELEGRAM_BOT_TOKEN"] ?? string.Empty;
    }

    public async Task SendMessageAsync(long chatId, string text, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
        {
            _logger.LogWarning("TELEGRAM_BOT_TOKEN not configured; skipping sendMessage.");
            return;
        }

        var url = $"https://api.telegram.org/bot{_token}/sendMessage";
        var payload = new
        {
            chat_id = chatId,
            text,
            parse_mode = "HTML",
            disable_web_page_preview = true
        };

        using var resp = await _http.PostAsJsonAsync(url, payload, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            _logger.LogError("Telegram sendMessage failed: {Status} {Body}", (int)resp.StatusCode, body);
        }
    }

    /// <summary>Reads the snake_case JSON body into a <see cref="TelegramUpdate"/>.</summary>
    public static TelegramUpdate? ParseUpdate(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        return JsonSerializer.Deserialize<TelegramUpdate>(json, SerializerOptions);
    }

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
