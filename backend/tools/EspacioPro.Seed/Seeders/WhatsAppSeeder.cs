using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Seed.Seeders;

/// <summary>
/// Inserts a handful of sample WhatsApp conversations with Spanish customer
/// messages (horarios, precios, inscripción) so the <c>/inbox</c> UI shows data.
/// Mirrors the other seeders; gated behind the <c>--whatsapp</c> flag.
/// </summary>
internal sealed class WhatsAppSeeder
{
    private readonly WaConversationRepository _conversations;
    private readonly WaMessageRepository _messages;
    private readonly ILogger<WhatsAppSeeder> _logger;

    public WhatsAppSeeder(
        WaConversationRepository conversations,
        WaMessageRepository messages,
        ILogger<WhatsAppSeeder> logger)
    {
        _conversations = conversations;
        _messages = messages;
        _logger = logger;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        // Ensure the whatsapp container exists locally before seeding.
        await _conversations.EnsureContainerAsync(ct);

        var samples = new[]
        {
            new Sample("Ana Torres", "+51999111222", WaLeadState.Interested,
                "Hola, ¿cuáles son los horarios de los cursos de mañana?"),
            new Sample("Carlos Méndez", "+51999333444", WaLeadState.New,
                "Buenas, quería saber los precios de la mensualidad."),
            new Sample("Lucía Ramos", "+51999555666", WaLeadState.Enrolled,
                "¿Cómo es el proceso de inscripción? ¿Necesito traer algún documento?"),
            new Sample("Pedro Salas", "+51999777888", WaLeadState.Paid,
                "Ya hice el pago de la inscripción, ¿me confirman?"),
            new Sample("María Flores", "+51999000111", WaLeadState.Support,
                "Tengo un problema para ingresar a la plataforma, ¿me ayudan?"),
            new Sample("Jorge Ríos", "+51999222333", WaLeadState.Visit,
                "Hola, antes de inscribirme me gustaría conocer la academia. ¿Puedo visitarlos?"),
        };

        var created = 0;
        foreach (var s in samples)
        {
            var now = DateTime.UtcNow.ToString("o");
            var convo = await _conversations.CreateAsync(new WaConversation
            {
                WaContactId = s.Phone.Replace("+", string.Empty),
                DisplayName = s.Name,
                Phone = s.Phone,
                Status = WaConversationStatus.Open,
                AiMode = WaAiMode.Assist,
                LeadState = s.LeadState,
                LastInboundAt = now,
                LastMessageAt = now,
                LastMessagePreview = s.Text,
                Unread = 1,
            }, ct);

            await _messages.CreateAsync(new WaMessage
            {
                ConversationId = convo.Id,
                Sender = WaMessageSender.Customer,
                Kind = WaMessageKind.Text,
                Text = s.Text,
                Status = WaMessageStatus.Delivered,
                Ts = now,
            }, ct);

            await _messages.CreateAsync(new WaMessage
            {
                ConversationId = convo.Id,
                Sender = WaMessageSender.Agent,
                Kind = WaMessageKind.Text,
                Text = "¡Hola! Gracias por escribir a Espacio Pro, en un momento te ayudamos.",
                Status = WaMessageStatus.Sent,
                Ts = DateTime.UtcNow.ToString("o"),
            }, ct);

            created++;
        }

        _logger.LogInformation("  whatsapp conversations: {Count}", created);
        return created;
    }

    private sealed record Sample(string Name, string Phone, WaLeadState LeadState, string Text);
}
