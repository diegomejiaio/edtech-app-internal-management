using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Telegram;

/// <summary>
/// One-time-per-worker registration of the bot's "/" command menu. Runs on host startup and
/// re-applies the canonical command list via <c>setMyCommands</c> (idempotent), so the menu stays
/// in sync on every deploy without any manual BotFather/curl step. Failures are non-fatal: a missing
/// menu never blocks message handling, and the call is bounded by a short timeout so a slow Telegram
/// API cannot stall cold start.
/// </summary>
public sealed class TelegramCommandSetup : IHostedService
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Canonical "/" menu. <c>setMyCommands</c> replaces the entire list, so this must contain every
    /// command the menu should show. The aliases <c>/new</c> and <c>/reset</c> still work but are kept
    /// out of the menu to avoid clutter.
    /// </summary>
    private static readonly IReadOnlyList<TelegramClient.BotCommand> Commands =
    [
        new("horarios", "Lista los horarios activos"),
        new("nuevo", "Reiniciar la conversación"),
        new("help", "Muestra los comandos disponibles"),
        new("ping", "Prueba de vida del bot"),
    ];

    private readonly TelegramClient _telegram;
    private readonly ILogger<TelegramCommandSetup> _logger;

    public TelegramCommandSetup(TelegramClient telegram, ILogger<TelegramCommandSetup> logger)
    {
        _telegram = telegram;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Timeout);

        try
        {
            await _telegram.SetMyCommandsAsync(Commands, cts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not register Telegram bot commands at startup; continuing.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
