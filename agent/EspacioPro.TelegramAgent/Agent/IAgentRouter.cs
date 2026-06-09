using EspacioPro.TelegramAgent.Telegram;

namespace EspacioPro.TelegramAgent.Agent;

/// <summary>
/// Routes an incoming Telegram message to a reply. This is the seam where the
/// Foundry Hosted Agent plugs in: <see cref="DeterministicAgentRouter"/> handles
/// the v0 commands locally, and a future <c>FoundryAgentRouter</c> can implement
/// the same contract to delegate natural-language / audio / image turns to the
/// hosted agent without touching the webhook function.
/// </summary>
public interface IAgentRouter
{
    Task<string> RouteAsync(TelegramMessage message, CancellationToken ct);
}
