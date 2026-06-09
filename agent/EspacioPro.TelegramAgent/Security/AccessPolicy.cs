using EspacioPro.TelegramAgent.Telegram;
using Microsoft.Extensions.Configuration;

namespace EspacioPro.TelegramAgent.Security;

/// <summary>
/// Authorization guard for the PoC: only an allowlisted chat and an allowlisted
/// set of user ids may issue commands. Everything else is silently ignored.
/// </summary>
public sealed class AccessPolicy
{
    private readonly long _allowedChatId;
    private readonly HashSet<long> _allowedUserIds;
    private readonly string _webhookSecret;

    public AccessPolicy(IConfiguration config)
    {
        _allowedChatId = ParseLong(config["TELEGRAM_ALLOWED_CHAT_ID"]);
        _allowedUserIds = ParseIdSet(config["TELEGRAM_ALLOWED_USER_IDS"]);
        _webhookSecret = config["TELEGRAM_WEBHOOK_SECRET"] ?? string.Empty;
    }

    /// <summary>Validates the secret token Telegram echoes from <c>setWebhook</c>.</summary>
    public bool IsValidWebhookSecret(string? headerValue)
    {
        if (string.IsNullOrEmpty(_webhookSecret))
            return true;

        return string.Equals(headerValue, _webhookSecret, StringComparison.Ordinal);
    }

    public bool IsAllowed(TelegramMessage message)
    {
        var chatId = message.Chat?.Id ?? 0;
        var userId = message.From?.Id ?? 0;

        if (_allowedChatId != 0 && chatId != _allowedChatId)
            return false;

        if (_allowedUserIds.Count > 0 && !_allowedUserIds.Contains(userId))
            return false;

        return true;
    }

    private static long ParseLong(string? raw)
        => long.TryParse(raw, out var value) ? value : 0;

    private static HashSet<long> ParseIdSet(string? raw)
    {
        var set = new HashSet<long>();
        if (string.IsNullOrWhiteSpace(raw))
            return set;

        foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (long.TryParse(part, out var value))
                set.Add(value);
        }

        return set;
    }
}
