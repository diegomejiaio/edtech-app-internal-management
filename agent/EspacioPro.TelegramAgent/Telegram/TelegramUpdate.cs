using System.Text.Json.Serialization;

namespace EspacioPro.TelegramAgent.Telegram;

/// <summary>
/// Minimal subset of the Telegram Bot API <c>Update</c> object.
/// Only the fields the PoC needs are mapped.
/// https://core.telegram.org/bots/api#update
/// </summary>
public sealed class TelegramUpdate
{
    [JsonPropertyName("update_id")]
    public long UpdateId { get; set; }

    [JsonPropertyName("message")]
    public TelegramMessage? Message { get; set; }
}

public sealed class TelegramMessage
{
    [JsonPropertyName("message_id")]
    public long MessageId { get; set; }

    [JsonPropertyName("from")]
    public TelegramUser? From { get; set; }

    [JsonPropertyName("chat")]
    public TelegramChat? Chat { get; set; }

    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("caption")]
    public string? Caption { get; set; }

    [JsonPropertyName("voice")]
    public TelegramVoice? Voice { get; set; }

    [JsonPropertyName("audio")]
    public TelegramAudio? Audio { get; set; }

    /// <summary>Photo sizes, ascending by resolution. The last element is the largest.</summary>
    [JsonPropertyName("photo")]
    public List<TelegramPhotoSize>? Photo { get; set; }
}

public sealed class TelegramVoice
{
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    [JsonPropertyName("mime_type")]
    public string? MimeType { get; set; }

    [JsonPropertyName("duration")]
    public int Duration { get; set; }
}

public sealed class TelegramAudio
{
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    [JsonPropertyName("mime_type")]
    public string? MimeType { get; set; }
}

public sealed class TelegramPhotoSize
{
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    [JsonPropertyName("width")]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    public int Height { get; set; }
}

public sealed class TelegramFile
{
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    [JsonPropertyName("file_path")]
    public string? FilePath { get; set; }

    [JsonPropertyName("file_size")]
    public long FileSize { get; set; }
}

public sealed class TelegramUser
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("is_bot")]
    public bool IsBot { get; set; }

    [JsonPropertyName("first_name")]
    public string? FirstName { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }
}

public sealed class TelegramChat
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }
}
