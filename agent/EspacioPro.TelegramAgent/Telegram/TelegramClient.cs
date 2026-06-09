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

    /// <summary>
    /// Registers the bot's "/" command menu via <c>setMyCommands</c>. Idempotent: the call replaces
    /// the full list, so it is safe to invoke on every startup. No-op when the token is unset.
    /// </summary>
    public async Task SetMyCommandsAsync(IReadOnlyList<BotCommand> commands, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
        {
            _logger.LogWarning("TELEGRAM_BOT_TOKEN not configured; skipping setMyCommands.");
            return;
        }

        var url = $"https://api.telegram.org/bot{_token}/setMyCommands";
        using var resp = await _http.PostAsJsonAsync(url, new { commands }, ct);
        if (resp.IsSuccessStatusCode)
        {
            _logger.LogInformation("Registered {Count} Telegram bot command(s).", commands.Count);
        }
        else
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            _logger.LogError("Telegram setMyCommands failed: {Status} {Body}", (int)resp.StatusCode, body);
        }
    }

    /// <summary>A single entry of the Telegram "/" command menu. Command must be lowercase, 1-32 chars.</summary>
    public sealed record BotCommand(string Command, string Description);

    /// <summary>
    /// Sends a chat action (e.g. <c>typing</c>) so the user sees a "typing…" hint while the bot works.
    /// Best-effort: the indicator auto-clears after ~5s, so callers re-send it periodically. No-op when
    /// the token is unset; non-cancellation failures are swallowed since the action is non-essential.
    /// </summary>
    public async Task SendChatActionAsync(long chatId, string action, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
            return;

        var url = $"https://api.telegram.org/bot{_token}/sendChatAction";
        try
        {
            using var resp = await _http.PostAsJsonAsync(url, new { chat_id = chatId, action }, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogDebug("Telegram sendChatAction failed: {Status} {Body}", (int)resp.StatusCode, body);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Telegram sendChatAction error for chat {ChatId}.", chatId);
        }
    }

    /// <summary>Resolves a Telegram <c>file_id</c> to a downloadable <c>file_path</c> via getFile.</summary>
    public async Task<string?> GetFilePathAsync(string fileId, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
        {
            _logger.LogWarning("TELEGRAM_BOT_TOKEN not configured; cannot resolve file.");
            return null;
        }

        var url = $"https://api.telegram.org/bot{_token}/getFile?file_id={Uri.EscapeDataString(fileId)}";
        using var resp = await _http.GetAsync(url, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("Telegram getFile failed: {Status}", (int)resp.StatusCode);
            return null;
        }

        var stream = await resp.Content.ReadAsStreamAsync(ct);
        var envelope = await JsonSerializer.DeserializeAsync<FileResponse>(stream, SerializerOptions, ct);
        return envelope?.Ok == true ? envelope.Result?.FilePath : null;
    }

    /// <summary>Downloads the bytes of a resolved <c>file_path</c>.</summary>
    public async Task<byte[]?> DownloadFileAsync(string filePath, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
            return null;

        var url = $"https://api.telegram.org/file/bot{_token}/{filePath}";
        using var resp = await _http.GetAsync(url, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("Telegram file download failed: {Status}", (int)resp.StatusCode);
            return null;
        }

        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    /// <summary>Reads the snake_case JSON body into a <see cref="TelegramUpdate"/>.</summary>
    public static TelegramUpdate? ParseUpdate(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        return JsonSerializer.Deserialize<TelegramUpdate>(json, SerializerOptions);
    }

    private sealed class FileResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("ok")]
        public bool Ok { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("result")]
        public TelegramFile? Result { get; set; }
    }

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
