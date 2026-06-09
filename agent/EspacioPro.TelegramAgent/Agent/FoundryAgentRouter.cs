using System.Collections.Concurrent;
using System.Globalization;
using Azure.AI.Agents.Persistent;
using EspacioPro.TelegramAgent.Agent.Foundry;
using EspacioPro.TelegramAgent.Speech;
using EspacioPro.TelegramAgent.Telegram;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Agent;

/// <summary>
/// v1 router: delegates each Telegram turn to a Foundry Persistent Agent. Conversation
/// state lives in a server-side thread, one per Telegram chat (cached in-memory, which
/// is sufficient for the single private group of the PoC). The run loop resolves the
/// agent's function-tool calls through <see cref="AgentToolDispatcher"/>.
///
/// Media handling (P5): voice notes are transcribed to text via <see cref="SpeechTranscriber"/>;
/// photos are uploaded to the agent and attached as image content blocks (used as payment
/// receipts that the vision-capable model reads).
/// </summary>
public sealed class FoundryAgentRouter : IAgentRouter
{
    private const int MaxToolIterations = 8;
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(600);

    private static readonly TimeZoneInfo LimaTimeZone = ResolveLimaTimeZone();
    private static readonly CultureInfo SpanishCulture = CultureInfo.GetCultureInfo("es-PE");

    private readonly FoundryAgentProvisioner _provisioner;
    private readonly AgentToolDispatcher _dispatcher;
    private readonly TelegramClient _telegram;
    private readonly SpeechTranscriber _transcriber;
    private readonly ILogger<FoundryAgentRouter> _logger;

    private readonly ConcurrentDictionary<long, string> _threadsByChat = new();
    private readonly ConcurrentDictionary<long, SemaphoreSlim> _locksByChat = new();

    public FoundryAgentRouter(
        FoundryAgentProvisioner provisioner,
        AgentToolDispatcher dispatcher,
        TelegramClient telegram,
        SpeechTranscriber transcriber,
        ILogger<FoundryAgentRouter> logger)
    {
        _provisioner = provisioner;
        _dispatcher = dispatcher;
        _telegram = telegram;
        _transcriber = transcriber;
        _logger = logger;
    }

    public async Task<string> RouteAsync(TelegramMessage message, CancellationToken ct)
    {
        var chatId = message.Chat?.Id ?? 0;
        var gate = _locksByChat.GetOrAdd(chatId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (IsResetCommand(message))
            {
                await ResetThreadAsync(chatId, ct);
                return "🔄 Listo, empezamos una conversación nueva. Olvidé el contexto anterior.";
            }

            var turn = await BuildTurnInputAsync(message, ct);
            if (turn is null)
                return "No pude entender tu mensaje. Envía texto, una nota de voz o una imagen de comprobante.";

            if (turn.IsFallback)
                return turn.Text;

            return await RunTurnAsync(chatId, turn, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Foundry turn failed for chat {ChatId}.", chatId);
            return "Ocurrió un error procesando tu mensaje. Intenta de nuevo en un momento.";
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// Normalizes a Telegram message into the text + image attachments that feed a thread turn.
    /// Returns null when there is nothing actionable.
    /// </summary>
    private async Task<TurnInput?> BuildTurnInputAsync(TelegramMessage message, CancellationToken ct)
    {
        var imageFileIds = new List<string>();
        var textParts = new List<string>();

        var text = message.Text?.Trim();
        var caption = message.Caption?.Trim();
        if (!string.IsNullOrEmpty(text))
            textParts.Add(text);
        if (!string.IsNullOrEmpty(caption))
            textParts.Add(caption);

        // Voice note / audio file -> transcribe to text.
        var audioFileId = message.Voice?.FileId ?? message.Audio?.FileId;
        if (!string.IsNullOrEmpty(audioFileId))
        {
            var transcript = await TranscribeAsync(audioFileId,
                message.Voice?.MimeType ?? message.Audio?.MimeType, ct);
            if (!string.IsNullOrWhiteSpace(transcript))
                textParts.Add(transcript);
            else
                return new TurnInput("No pude transcribir el audio. ¿Puedes repetirlo o escribirlo?", imageFileIds, IsFallback: true);
        }

        // Photo -> upload the largest size and attach as an image content block.
        if (message.Photo is { Count: > 0 })
        {
            var largest = message.Photo[^1];
            var fileId = await UploadTelegramPhotoAsync(largest.FileId, ct);
            if (!string.IsNullOrEmpty(fileId))
                imageFileIds.Add(fileId);
        }

        var combinedText = string.Join("\n", textParts).Trim();

        if (imageFileIds.Count > 0 && string.IsNullOrEmpty(combinedText))
            combinedText = "Adjunto la imagen de un comprobante de pago. Extrae los datos y registra el pago.";

        if (string.IsNullOrEmpty(combinedText) && imageFileIds.Count == 0)
            return null;

        return new TurnInput(combinedText, imageFileIds);
    }

    private async Task<string?> TranscribeAsync(string fileId, string? mimeType, CancellationToken ct)
    {
        var filePath = await _telegram.GetFilePathAsync(fileId, ct);
        if (string.IsNullOrEmpty(filePath))
            return null;

        var bytes = await _telegram.DownloadFileAsync(filePath, ct);
        if (bytes is null || bytes.Length == 0)
            return null;

        var fileName = Path.GetFileName(filePath);
        if (string.IsNullOrEmpty(fileName))
            fileName = "voice.ogg";

        var contentType = string.IsNullOrEmpty(mimeType) ? "audio/ogg" : mimeType;
        return await _transcriber.TranscribeAsync(bytes, fileName, contentType, ct);
    }

    private async Task<string?> UploadTelegramPhotoAsync(string telegramFileId, CancellationToken ct)
    {
        var filePath = await _telegram.GetFilePathAsync(telegramFileId, ct);
        if (string.IsNullOrEmpty(filePath))
            return null;

        var bytes = await _telegram.DownloadFileAsync(filePath, ct);
        if (bytes is null || bytes.Length == 0)
            return null;

        var fileName = Path.GetFileName(filePath);
        if (string.IsNullOrEmpty(fileName))
            fileName = "receipt.jpg";

        using var stream = new MemoryStream(bytes);
        PersistentAgentFileInfo uploaded = await _provisioner.Client.Files.UploadFileAsync(
            stream, PersistentAgentFilePurpose.Agents, fileName, ct);
        return uploaded.Id;
    }

    private async Task<string> RunTurnAsync(long chatId, TurnInput turn, CancellationToken ct)
    {
        var client = _provisioner.Client;
        var agentId = await _provisioner.EnsureAgentAsync(ct);
        var threadId = await GetOrCreateThreadAsync(chatId, ct);

        await AddUserMessageAsync(threadId, turn, ct);

        ThreadRun run = await client.Runs.CreateRunAsync(threadId, agentId, cancellationToken: ct);

        var iterations = 0;
        while (true)
        {
            run = await PollUntilSettledAsync(threadId, run, ct);

            if (run.Status == RunStatus.RequiresAction
                && run.RequiredAction is SubmitToolOutputsAction action)
            {
                if (++iterations > MaxToolIterations)
                {
                    _logger.LogWarning("Tool loop exceeded {Max} iterations for chat {ChatId}.", MaxToolIterations, chatId);
                    return "No pude completar la operación (demasiados pasos). Intenta reformular tu pedido.";
                }

                var outputs = await ResolveToolOutputsAsync(action, ct);
                run = await client.Runs.SubmitToolOutputsToRunAsync(run, outputs, toolApprovals: null, cancellationToken: ct);
                continue;
            }

            break;
        }

        if (run.Status != RunStatus.Completed)
        {
            _logger.LogWarning("Run ended with status {Status}: {Error}", run.Status, run.LastError?.Message);
            return "No pude completar tu solicitud. Intenta de nuevo.";
        }

        return await ReadLatestAgentReplyAsync(threadId, ct);
    }

    private async Task AddUserMessageAsync(string threadId, TurnInput turn, CancellationToken ct)
    {
        var client = _provisioner.Client;
        var messageText = PrependDateContext(turn.Text);

        if (turn.ImageFileIds.Count == 0)
        {
            await client.Messages.CreateMessageAsync(threadId, MessageRole.User, messageText, cancellationToken: ct);
            return;
        }

        var blocks = new List<MessageInputContentBlock>();
        if (!string.IsNullOrEmpty(messageText))
            blocks.Add(new MessageInputTextBlock(messageText));

        foreach (var fileId in turn.ImageFileIds)
            blocks.Add(new MessageInputImageFileBlock(new MessageImageFileParam(fileId)));

        await client.Messages.CreateMessageAsync(threadId, MessageRole.User, blocks, cancellationToken: ct);
    }

    /// <summary>
    /// Prepends a system-context line with the current date/time in Lima so the agent can
    /// resolve relative references like "hoy". The agent's static instructions cannot hold a
    /// live date, so it is injected into every user turn instead.
    /// </summary>
    private static string PrependDateContext(string text)
    {
        var nowLima = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, LimaTimeZone);
        var formatted = nowLima.ToString("dddd d 'de' MMMM 'de' yyyy, HH:mm", SpanishCulture);
        var context = $"[Contexto del sistema] Fecha y hora actual en Lima (America/Lima, UTC-5): {formatted}.";
        return string.IsNullOrEmpty(text) ? context : $"{context}\n\n{text}";
    }

    private static TimeZoneInfo ResolveLimaTimeZone()
    {
        foreach (var id in new[] { "America/Lima", "SA Pacific Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("Lima-UTC-5", TimeSpan.FromHours(-5), "Lima (UTC-5)", "Lima (UTC-5)");
    }

    private async Task<ThreadRun> PollUntilSettledAsync(string threadId, ThreadRun run, CancellationToken ct)
    {
        while (run.Status == RunStatus.Queued || run.Status == RunStatus.InProgress)
        {
            await Task.Delay(PollInterval, ct);
            run = await _provisioner.Client.Runs.GetRunAsync(threadId, run.Id, ct);
        }
        return run;
    }

    private async Task<List<ToolOutput>> ResolveToolOutputsAsync(SubmitToolOutputsAction action, CancellationToken ct)
    {
        var outputs = new List<ToolOutput>();
        foreach (RequiredToolCall toolCall in action.ToolCalls)
        {
            if (toolCall is RequiredFunctionToolCall fnCall)
            {
                var result = await _dispatcher.ExecuteAsync(fnCall.Name, fnCall.Arguments, ct);
                outputs.Add(new ToolOutput(toolCall, result));
            }
            else
            {
                outputs.Add(new ToolOutput(toolCall, "{\"error\":\"Unsupported tool call type.\"}"));
            }
        }
        return outputs;
    }

    private async Task<string> ReadLatestAgentReplyAsync(string threadId, CancellationToken ct)
    {
        var messages = _provisioner.Client.Messages.GetMessagesAsync(
            threadId: threadId, order: ListSortOrder.Descending, cancellationToken: ct);

        await foreach (PersistentThreadMessage message in messages)
        {
            if (message.Role != MessageRole.Agent)
                continue;

            foreach (MessageContent content in message.ContentItems)
            {
                if (content is MessageTextContent textContent && !string.IsNullOrWhiteSpace(textContent.Text))
                    return textContent.Text;
            }
        }

        return "Listo.";
    }

    private async Task<string> GetOrCreateThreadAsync(long chatId, CancellationToken ct)
    {
        if (_threadsByChat.TryGetValue(chatId, out var existing))
            return existing;

        PersistentAgentThread thread = await _provisioner.Client.Threads.CreateThreadAsync(cancellationToken: ct);
        return _threadsByChat.GetOrAdd(chatId, thread.Id);
    }

    /// <summary>
    /// True when the message is a conversation-reset command (<c>/nuevo</c>, <c>/new</c> or
    /// <c>/reset</c>), tolerating a bot mention suffix (e.g. <c>/nuevo@MyBot</c>).
    /// </summary>
    private static bool IsResetCommand(TelegramMessage message)
    {
        var text = message.Text?.Trim();
        if (string.IsNullOrEmpty(text) || text[0] != '/')
            return false;

        var token = text.Split([' ', '\n', '\t', '\r'], 2)[0];
        var command = token.Split('@', 2)[0].ToLowerInvariant();
        return command is "/nuevo" or "/new" or "/reset";
    }

    /// <summary>
    /// Forgets the cached thread for a chat so the next message starts a fresh conversation.
    /// Best-effort deletes the server-side Foundry thread to avoid orphan accumulation; failures
    /// are non-fatal since dropping the cache reference already resets the context.
    /// </summary>
    private async Task ResetThreadAsync(long chatId, CancellationToken ct)
    {
        if (!_threadsByChat.TryRemove(chatId, out var threadId))
            return;

        try
        {
            await _provisioner.Client.Threads.DeleteThreadAsync(threadId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete Foundry thread {ThreadId} on reset for chat {ChatId}.", threadId, chatId);
        }
    }

    /// <summary>Normalized input for a single thread turn: text plus uploaded image file ids.</summary>
    private sealed record TurnInput(string Text, List<string> ImageFileIds, bool IsFallback = false);
}
