using System.Net;
using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="AgentThread"/> documents in the <c>operations</c> container.
/// Persists the Telegram <c>chatId → Foundry threadId</c> mapping so the agent's conversation
/// survives Function worker restarts.
/// </summary>
/// <remarks>
/// This repository deliberately bypasses the base <c>CreateAsync</c>/<c>UpdateAsync</c>/<c>SoftDeleteAsync</c>:
/// <list type="bullet">
/// <item><description>The document <c>id</c> is the Telegram <c>chatId</c> (not a GUID) so it can be point-read.</description></item>
/// <item><description>Writes are idempotent upserts that reset the native Cosmos <c>ttl</c> (sliding 7-day window).</description></item>
/// <item><description>Reset performs a hard delete, since the mapping carries no audit value once cleared.</description></item>
/// </list>
/// </remarks>
public sealed class AgentThreadRepository : CosmosRepository<AgentThread>
{
    protected override string ContainerName => ContainerNames.Operations;
    protected override string TypeDiscriminator => EntityTypes.AgentThread;

    public AgentThreadRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<AgentThreadRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>Point-reads the mapping for a Telegram chat. Returns <c>null</c> if absent or TTL-expired.</summary>
    public async Task<AgentThread?> GetByChatIdAsync(long chatId, CancellationToken ct = default)
    {
        try
        {
            var response = await Container.ReadItemAsync<AgentThread>(
                chatId.ToString(),
                new PartitionKey(TypeDiscriminator),
                cancellationToken: ct);

            var entity = response.Resource;
            entity.ETag = response.ETag;
            return entity;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <summary>
    /// Creates or replaces the mapping for a chat, resetting the 7-day TTL.
    /// The document <c>id</c> is the <c>chatId</c> so subsequent reads are point-reads.
    /// </summary>
    public async Task<AgentThread> UpsertAsync(long chatId, string threadId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow.ToString("o");
        var existing = await GetByChatIdAsync(chatId, ct);

        var entity = existing ?? new AgentThread { CreatedAt = now };
        entity.Id = chatId.ToString();
        entity.ChatId = chatId;
        entity.ThreadId = threadId;
        entity.Active = true;
        entity.UpdatedAt = now;
        entity.Ttl = AgentThread.TtlSeconds;

        var response = await Container.UpsertItemAsync(
            entity,
            new PartitionKey(TypeDiscriminator),
            cancellationToken: ct);

        var saved = response.Resource;
        saved.ETag = response.ETag;
        return saved;
    }

    /// <summary>Hard-deletes the mapping for a chat. No-op (idempotent) if it does not exist.</summary>
    public async Task DeleteAsync(long chatId, CancellationToken ct = default)
    {
        try
        {
            await Container.DeleteItemAsync<AgentThread>(
                chatId.ToString(),
                new PartitionKey(TypeDiscriminator),
                cancellationToken: ct);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already gone — treat as success.
        }
    }
}
