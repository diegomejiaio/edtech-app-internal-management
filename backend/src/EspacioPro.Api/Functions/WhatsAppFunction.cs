using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Application.Common;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// WhatsApp CRM (MVP) inbox endpoints per <c>docs/10-whatsapp-crm-mvp.md</c> §2.
/// Conversation/message CRUD requires <c>[RequireRole("admin")]</c>. The Meta webhook
/// is anonymous (verified by token/HMAC) and is a stub for v1.
/// </summary>
public sealed class WhatsAppFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;
    private const int PreviewLength = 120;

    private readonly WaConversationRepository _conversations;
    private readonly WaMessageRepository _messages;
    private readonly ILogger<WhatsAppFunction> _logger;

    public WhatsAppFunction(
        WaConversationRepository conversations,
        WaMessageRepository messages,
        ILogger<WhatsAppFunction> logger)
    {
        _conversations = conversations;
        _messages = messages;
        _logger = logger;
    }

    /// <summary>GET /api/v1/wa/conversations — paginated list with status + search filters.</summary>
    [Function("WaConversationList")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListConversations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/wa/conversations")] HttpRequest req,
        CancellationToken ct)
    {
        var search = req.Query["search"].FirstOrDefault();
        var statusRaw = req.Query["status"].FirstOrDefault();
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        WaConversationStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (!Enum.TryParse<WaConversationStatus>(statusRaw, ignoreCase: true, out var parsed))
                return req.ValidationError("status", "status must be one of: open, pending, closed.");
            status = parsed;
        }

        var (items, total) = await _conversations.SearchAsync(status, search, limit, offset, ct);
        return new OkObjectResult(new Paginated<WaConversation>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/wa/conversations/{id}.</summary>
    [Function("WaConversationGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetConversation(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/wa/conversations/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var convo = await _conversations.GetByIdAsync(id, ct);
        return convo is null
            ? req.NotFound($"Conversation '{id}' not found.")
            : new OkObjectResult(convo);
    }

    /// <summary>
    /// PUT/PATCH /api/v1/wa/conversations/{id} — partial update of status/assignedTo/aiMode/leadState.
    /// Both verbs are accepted (partial semantics) so frontend clients limited to PUT can update too.
    /// </summary>
    [Function("WaConversationPatch")]
    [RequireRole("admin")]
    public async Task<IActionResult> PatchConversation(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", "patch", Route = "v1/wa/conversations/{id}")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var convo = await _conversations.GetByIdAsync(id, ct);
        if (convo is null)
            return req.NotFound($"Conversation '{id}' not found.");

        var body = await req.ReadFromJsonAsync<ConversationPatchRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        if (body.Status is { } status) convo.Status = status;
        if (body.AiMode is { } aiMode) convo.AiMode = aiMode;
        if (body.LeadState is { } leadState) convo.LeadState = leadState;
        if (body.AssignedTo is not null) convo.AssignedTo = body.AssignedTo.Trim();
        if (body.Program is not null) convo.Program = string.IsNullOrWhiteSpace(body.Program) ? null : body.Program.Trim();
        if (body.VisitAt is not null) convo.VisitAt = string.IsNullOrWhiteSpace(body.VisitAt) ? null : body.VisitAt.Trim();

        var updated = await _conversations.UpdateAsync(convo, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>GET /api/v1/wa/conversations/{id}/messages — paginated thread (oldest first).</summary>
    [Function("WaMessageList")]
    [RequireRole("admin")]
    public async Task<IActionResult> ListMessages(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/wa/conversations/{id}/messages")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var convo = await _conversations.GetByIdAsync(id, ct);
        if (convo is null)
            return req.NotFound($"Conversation '{id}' not found.");

        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        var (items, total) = await _messages.ListByConversationAsync(id, limit, offset, ct);
        return new OkObjectResult(new Paginated<WaMessage>(items, total, limit, offset));
    }

    /// <summary>
    /// POST /api/v1/wa/conversations/{id}/messages — agent manual reply (stub send).
    /// Stores agent message status=sent, marks conversation read and updates lastMessage*.
    /// </summary>
    [Function("WaMessageCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> SendMessage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/wa/conversations/{id}/messages")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var convo = await _conversations.GetByIdAsync(id, ct);
        if (convo is null)
            return req.NotFound($"Conversation '{id}' not found.");

        var body = await req.ReadFromJsonAsync<SendMessageRequest>(ct);
        if (body is null || string.IsNullOrWhiteSpace(body.Text))
            return req.ValidationError("text", "The text field is required.");

        var now = DateTime.UtcNow.ToString("o");
        var text = body.Text.Trim();

        var message = new WaMessage
        {
            ConversationId = id,
            Sender = WaMessageSender.Agent,
            Kind = WaMessageKind.Text,
            Text = text,
            Status = WaMessageStatus.Sent, // stub: real Meta send is out of scope
            Ts = now,
            AiSuggested = body.AiSuggested ?? false,
            Confidence = body.Confidence,
        };
        var created = await _messages.CreateAsync(message, ct);

        convo.LastMessageAt = now;
        convo.LastMessagePreview = Preview(text);
        convo.Unread = 0; // sending marks the thread read
        await _conversations.UpdateAsync(convo, ct);

        return req.Created(created, $"v1/wa/conversations/{id}/messages/{created.Id}");
    }

    /// <summary>POST /api/v1/wa/conversations/{id}/ai-suggest — stub suggestion + confidence.</summary>
    /// <remarks>
    /// Optional body <c>{ "instruction": "..." }</c> lets the agent steer the reply
    /// (assisted mode), e.g. "dile que solo atendemos los lunes". v1 is a heuristic stub;
    /// real natural-language drafting arrives with the MAF orchestrator (doc §6 / Fase 3).
    /// </remarks>
    [Function("WaAiSuggest")]
    [RequireRole("admin")]
    public async Task<IActionResult> AiSuggest(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/wa/conversations/{id}/ai-suggest")] HttpRequest req,
        string id,
        CancellationToken ct)
    {
        var convo = await _conversations.GetByIdAsync(id, ct);
        if (convo is null)
            return req.NotFound($"Conversation '{id}' not found.");

        AiSuggestRequest? body = null;
        try { body = await req.ReadFromJsonAsync<AiSuggestRequest>(ct); }
        catch (System.Text.Json.JsonException) { /* empty/invalid body → no instruction */ }

        var instruction = body?.Instruction?.Trim();
        var firstName = convo.DisplayName?.Split(' ').FirstOrDefault() ?? "";

        string suggestion;
        double confidence;
        if (!string.IsNullOrWhiteSpace(instruction))
        {
            // Heuristic draft from the agent's instruction. Real rephrasing = MAF (Fase 3).
            suggestion = $"Hola {firstName}, gracias por tu mensaje. Entiendo 🙂. " +
                $"{RephraseInstruction(instruction)} ¿Te puedo ayudar con algo más?";
            confidence = 0.8;
        }
        else
        {
            suggestion = $"Hola {firstName}, gracias por escribir a Espacio Pro. " +
                "Tenemos horarios de mañana y tarde. ¿Te comparto la información de precios e inscripción?";
            confidence = 0.6;
        }

        return new OkObjectResult(new AiSuggestResponse(suggestion, confidence));
    }

    /// <summary>
    /// POST /api/v1/wa/messages/improve — rewrite/proofread/adjust the agent's draft.
    /// Body <c>{ text, action, instruction? }</c>. Heuristic stub; real rewriting = MAF (Fase 3).
    /// </summary>
    [Function("WaImproveMessage")]
    [RequireRole("admin")]
    public async Task<IActionResult> ImproveMessage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/wa/messages/improve")] HttpRequest req,
        CancellationToken ct)
    {
        ImproveRequest? body = null;
        try { body = await req.ReadFromJsonAsync<ImproveRequest>(ct); }
        catch (System.Text.Json.JsonException) { /* empty/invalid body */ }

        if (body is null || string.IsNullOrWhiteSpace(body.Text))
            return req.ValidationError("text", "The text field is required.");

        var improved = ImproveText(body.Text.Trim(), body.Action);
        return new OkObjectResult(new ImproveResponse(improved));
    }

    /// <summary>
    /// GET/POST /api/v1/wa/webhook — Meta webhook. GET verifies (echoes hub.challenge),
    /// POST acknowledges events. Stub for v1, HMAC-ready. Anonymous by design.
    /// </summary>
    [Function("WaWebhook")]
    public async Task<IActionResult> Webhook(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "v1/wa/webhook")] HttpRequest req,
        CancellationToken ct)
    {
        if (HttpMethods.IsGet(req.Method))
        {
            var challenge = req.Query["hub.challenge"].FirstOrDefault();
            return string.IsNullOrEmpty(challenge)
                ? new BadRequestResult()
                : new ContentResult { Content = challenge, StatusCode = StatusCodes.Status200OK };
        }

        // POST: acknowledge events. Real processing/HMAC verification is out of scope (doc §4).
        _logger.LogInformation("WhatsApp webhook event received (stub, not processed).");
        await Task.CompletedTask;
        return new OkResult();
    }

    // --- Helpers ---

    private static int ClampLimit(string? raw) => Math.Clamp(ParseInt(raw, DefaultLimit), 1, MaxLimit);

    private static int ParseInt(string? raw, int fallback) => int.TryParse(raw, out var v) ? v : fallback;

    private static string Preview(string text) =>
        text.Length <= PreviewLength ? text : text[..PreviewLength];

    /// <summary>
    /// Turns an agent instruction into a customer-facing sentence by stripping common
    /// Spanish lead-ins ("dile que", "responde que", ...) and capitalizing. Heuristic
    /// placeholder for the MAF orchestrator (Fase 3).
    /// </summary>
    private static string RephraseInstruction(string instruction)
    {
        var s = instruction.Trim();
        string[] leadIns =
        {
            "dile que", "dile", "responde que", "responde", "contesta que", "contesta",
            "contestale que", "menciona que", "avisale que", "indicale que", "explicale que", "que ",
        };
        var lower = s.ToLowerInvariant();
        foreach (var lead in leadIns)
        {
            if (lower.StartsWith(lead, StringComparison.Ordinal))
            {
                s = s[lead.Length..].TrimStart();
                break;
            }
        }
        if (s.Length == 0) return instruction.Trim();
        s = char.ToUpperInvariant(s[0]) + s[1..];
        if (!s.EndsWith('.') && !s.EndsWith('!') && !s.EndsWith('?')) s += ".";
        return s;
    }

    private sealed record ConversationPatchRequest(
        WaConversationStatus? Status,
        string? AssignedTo,
        WaAiMode? AiMode,
        WaLeadState? LeadState,
        string? Program,
        string? VisitAt);

    private sealed record SendMessageRequest(string? Text, bool? AiSuggested, double? Confidence);

    private sealed record AiSuggestRequest(string? Instruction);

    private sealed record AiSuggestResponse(string Suggestion, double Confidence);

    private sealed record ImproveRequest(string? Text, string? Action, string? Instruction);

    private sealed record ImproveResponse(string Text);

    /// <summary>
    /// Heuristic draft transformer (rewrite/proofread/adjust tone). Placeholder for the
    /// MAF orchestrator (Fase 3); v1 applies simple deterministic tweaks.
    /// </summary>
    private static string ImproveText(string text, string? action) => (action?.ToLowerInvariant()) switch
    {
        "proofread" => Proofread(text),
        "concise" => text.Split('.', '\n')[0].Trim().TrimEnd('.') + ".",
        "longer" => text.TrimEnd() + " Quedamos atentos a cualquier consulta adicional.",
        "casual" => "¡Hola! " + text + " 😊",
        "professional" => "Estimado/a, " + text + " Quedamos atentos.",
        "confident" => text.TrimEnd() + " Cuente con nosotros para lo que necesite.",
        "enthusiastic" => "¡" + text.TrimEnd('.', '!', ' ') + "! 🎉",
        _ => "En otras palabras: " + text, // rewrite / custom / unknown
    };

    private static string Proofread(string text)
    {
        if (text.Length == 0) return text;
        var s = char.ToUpperInvariant(text[0]) + text[1..];
        if (!s.EndsWith('.') && !s.EndsWith('!') && !s.EndsWith('?')) s += ".";
        return s;
    }
}
