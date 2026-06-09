using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Telegram agent thread-persistence endpoints. Store the <c>chatId → Foundry threadId</c>
/// mapping in Cosmos so the agent's conversation survives Function worker restarts.
/// All endpoints require <c>[RequireRole("admin")]</c>; the agent reaches them via its
/// <c>X-Agent-Key</c> admin bypass.
/// </summary>
public sealed class AgentThreadFunction
{
    private readonly AgentThreadRepository _repo;
    private readonly ILogger<AgentThreadFunction> _logger;

    public AgentThreadFunction(AgentThreadRepository repo, ILogger<AgentThreadFunction> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/agent/threads/{chatId} — returns the persisted thread mapping or 404.</summary>
    [Function("AgentThreadGet")]
    [RequireRole("admin")]
    public async Task<IActionResult> Get(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/agent/threads/{chatId}")] HttpRequest req,
        string chatId,
        CancellationToken ct)
    {
        if (!long.TryParse(chatId, out var id))
            return req.ValidationError("chatId", "chatId must be a numeric Telegram chat id.");

        var thread = await _repo.GetByChatIdAsync(id, ct);
        if (thread is null)
            return req.NotFound($"No thread mapping for chat '{chatId}'.");

        return new OkObjectResult(AgentThreadResponse.From(thread));
    }

    /// <summary>PUT /api/v1/agent/threads/{chatId} — upserts the mapping and resets the 7-day TTL.</summary>
    [Function("AgentThreadPut")]
    [RequireRole("admin")]
    public async Task<IActionResult> Put(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/agent/threads/{chatId}")] HttpRequest req,
        string chatId,
        CancellationToken ct)
    {
        if (!long.TryParse(chatId, out var id))
            return req.ValidationError("chatId", "chatId must be a numeric Telegram chat id.");

        var body = await req.ReadFromJsonAsync<AgentThreadWriteRequest>(ct);
        if (body is null || string.IsNullOrWhiteSpace(body.ThreadId))
            return req.ValidationError("threadId", "threadId is required.");

        var saved = await _repo.UpsertAsync(id, body.ThreadId.Trim(), ct);
        _logger.LogInformation("Persisted agent thread mapping for chat {ChatId}", id);
        return new OkObjectResult(AgentThreadResponse.From(saved));
    }

    /// <summary>DELETE /api/v1/agent/threads/{chatId} — hard-deletes the mapping (idempotent).</summary>
    [Function("AgentThreadDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/agent/threads/{chatId}")] HttpRequest req,
        string chatId,
        CancellationToken ct)
    {
        if (!long.TryParse(chatId, out var id))
            return req.ValidationError("chatId", "chatId must be a numeric Telegram chat id.");

        await _repo.DeleteAsync(id, ct);
        _logger.LogInformation("Deleted agent thread mapping for chat {ChatId}", id);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }
}

/// <summary>Request body for upserting a thread mapping.</summary>
public sealed record AgentThreadWriteRequest(string ThreadId);

/// <summary>Response shape for a persisted thread mapping.</summary>
public sealed record AgentThreadResponse(long ChatId, string ThreadId, string UpdatedAt)
{
    public static AgentThreadResponse From(EspacioPro.Domain.Entities.AgentThread t) =>
        new(t.ChatId, t.ThreadId, t.UpdatedAt);
}
