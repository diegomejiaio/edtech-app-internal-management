using EspacioPro.TelegramAgent.Agent;
using EspacioPro.TelegramAgent.Security;
using EspacioPro.TelegramAgent.Telegram;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Functions;

/// <summary>
/// Single entry point for Telegram updates. Validates the webhook secret, enforces
/// the chat/user allowlist, routes the message and replies via sendMessage.
/// Always returns 200 so Telegram does not retry on ignored/unauthorized updates.
/// </summary>
public sealed class TelegramWebhookFunction
{
    private const string SecretHeader = "X-Telegram-Bot-Api-Secret-Token";

    private readonly AccessPolicy _policy;
    private readonly IAgentRouter _router;
    private readonly TelegramClient _telegram;
    private readonly ILogger<TelegramWebhookFunction> _logger;

    public TelegramWebhookFunction(
        AccessPolicy policy,
        IAgentRouter router,
        TelegramClient telegram,
        ILogger<TelegramWebhookFunction> logger)
    {
        _policy = policy;
        _router = router;
        _telegram = telegram;
        _logger = logger;
    }

    [Function("TelegramWebhook")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "telegram/webhook")] HttpRequest req,
        CancellationToken ct)
    {
        var secret = req.Headers[SecretHeader].FirstOrDefault();
        if (!_policy.IsValidWebhookSecret(secret))
        {
            _logger.LogWarning("Rejected webhook call with invalid secret token.");
            return new UnauthorizedResult();
        }

        using var reader = new StreamReader(req.Body);
        var body = await reader.ReadToEndAsync(ct);
        var update = TelegramClient.ParseUpdate(body);

        var message = update?.Message;
        if (message?.Chat is null)
            return new OkResult();

        if (!_policy.IsAllowed(message))
        {
            _logger.LogWarning(
                "Ignored message from unauthorized chat {ChatId} / user {UserId}.",
                message.Chat.Id,
                message.From?.Id);
            return new OkResult();
        }

        var reply = await RouteWithTypingAsync(message, ct);
        if (!string.IsNullOrWhiteSpace(reply))
            await _telegram.SendMessageAsync(message.Chat.Id, reply, ct);

        return new OkResult();
    }

    /// <summary>
    /// Runs the router while keeping Telegram's "typing…" indicator alive. The indicator auto-clears
    /// after ~5s, so a background pulse re-sends <c>sendChatAction("typing")</c> every few seconds
    /// until the turn completes. The pulse is best-effort and never affects the reply.
    /// </summary>
    private async Task<string> RouteWithTypingAsync(TelegramMessage message, CancellationToken ct)
    {
        using var typingCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var pulse = PulseTypingAsync(message.Chat!.Id, typingCts.Token);
        try
        {
            return await _router.RouteAsync(message, ct);
        }
        finally
        {
            typingCts.Cancel();
            try { await pulse; }
            catch (OperationCanceledException) { /* expected on completion */ }
        }
    }

    /// <summary>Re-sends the "typing…" action every few seconds until cancelled.</summary>
    private async Task PulseTypingAsync(long chatId, CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                await _telegram.SendChatActionAsync(chatId, "typing", ct);
                await Task.Delay(TimeSpan.FromSeconds(4), ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected when the turn finishes; stop quietly.
        }
    }
}
