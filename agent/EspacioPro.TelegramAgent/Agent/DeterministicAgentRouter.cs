using System.Globalization;
using System.Text;
using EspacioPro.TelegramAgent.Api;
using EspacioPro.TelegramAgent.Telegram;

namespace EspacioPro.TelegramAgent.Agent;

/// <summary>
/// v0 router: resolves the two deterministic commands (<c>/ping</c>, <c>/horarios</c>)
/// without an LLM. Natural-language, audio and image turns return a "coming soon"
/// hint and will be delegated to the Foundry Hosted Agent in v1.
/// </summary>
public sealed class DeterministicAgentRouter : IAgentRouter
{
    private const int ScheduleLimit = 10;

    private readonly EspacioProApiClient _api;

    public DeterministicAgentRouter(EspacioProApiClient api)
    {
        _api = api;
    }

    public async Task<string> RouteAsync(TelegramMessage message, CancellationToken ct)
    {
        var text = (message.Text ?? string.Empty).Trim();
        var command = ParseCommand(text);

        return command switch
        {
            "/ping" => "pong 🏓",
            "/start" => HelpText(),
            "/help" => HelpText(),
            "/horarios" => await RenderSchedulesAsync(ct),
            _ => HelpText()
        };
    }

    private async Task<string> RenderSchedulesAsync(CancellationToken ct)
    {
        var schedules = await _api.GetSchedulesAsync(ScheduleLimit, ct);
        if (schedules.Count == 0)
            return "No encontré horarios activos.";

        var sb = new StringBuilder();
        sb.AppendLine($"<b>Horarios activos ({schedules.Count})</b>");
        foreach (var s in schedules)
        {
            var time = string.IsNullOrEmpty(s.StartTime) ? "" : $" {s.StartTime}";
            var seats = $"{s.EnrolledActiveCount}/{s.Capacity}";
            sb.AppendLine($"• <b>{Escape(s.Course)}</b> ({Escape(s.Level)}) — {Escape(s.TeacherName)}");
            sb.AppendLine($"  {Escape(s.Weekdays)}{time} · {Escape(s.StartDate)} · {seats} inscritos");
        }

        return sb.ToString().TrimEnd();
    }

    private static string HelpText() =>
        "👋 <b>Espacio Pro Bot (PoC)</b>\n" +
        "Comandos disponibles:\n" +
        "• <code>/ping</code> — prueba de vida\n" +
        "• <code>/horarios</code> — lista horarios activos\n\n" +
        "Próximamente (vía agente Foundry): crear horarios por audio y registrar pagos desde imágenes.";

    private static string ParseCommand(string text)
    {
        if (string.IsNullOrEmpty(text) || text[0] != '/')
            return string.Empty;

        var token = text.Split(new[] { ' ', '@' }, 2, StringSplitOptions.RemoveEmptyEntries)[0];
        return token.ToLower(CultureInfo.InvariantCulture);
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "—";

        return value
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;");
    }
}
