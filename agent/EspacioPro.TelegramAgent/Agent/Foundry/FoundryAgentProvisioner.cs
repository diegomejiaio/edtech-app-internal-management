using System.Reflection;
using Azure.AI.Agents.Persistent;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EspacioPro.TelegramAgent.Agent.Foundry;

/// <summary>
/// Owns the <see cref="PersistentAgentsClient"/> and lazily ensures a single agent
/// definition exists in the Foundry project. The agent is identified by a versioned
/// name: to change instructions or tools, bump <see cref="AgentName"/> so a fresh
/// definition is created instead of silently reusing a stale one. The resolved agent
/// id is cached for the lifetime of the process.
/// </summary>
public sealed class FoundryAgentProvisioner
{
    /// <summary>Bump the version suffix whenever instructions or tools change.</summary>
    public const string AgentName = "espaciopro-telegram-agent-v3";

    private readonly PersistentAgentsClient _client;
    private readonly string _model;
    private readonly ILogger<FoundryAgentProvisioner> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private string? _agentId;

    public FoundryAgentProvisioner(IConfiguration config, ILogger<FoundryAgentProvisioner> logger)
    {
        _logger = logger;
        var endpoint = config["PROJECT_ENDPOINT"]
            ?? throw new InvalidOperationException("PROJECT_ENDPOINT is not configured.");
        _model = config["AGENT_MODEL"] ?? "gpt-4.1";
        _client = new PersistentAgentsClient(endpoint, new DefaultAzureCredential());
    }

    public PersistentAgentsClient Client => _client;

    /// <summary>Returns the agent id, creating the agent on first use.</summary>
    public async Task<string> EnsureAgentAsync(CancellationToken ct)
    {
        if (_agentId is not null)
            return _agentId;

        await _gate.WaitAsync(ct);
        try
        {
            if (_agentId is not null)
                return _agentId;

            var existing = await FindByNameAsync(ct);
            if (existing is not null)
            {
                _logger.LogInformation("Reusing Foundry agent {Name} ({Id}).", AgentName, existing);
                _agentId = existing;
                return _agentId;
            }

            PersistentAgent agent = await _client.Administration.CreateAgentAsync(
                model: _model,
                name: AgentName,
                instructions: Instructions,
                tools: AgentToolset.Definitions,
                cancellationToken: ct);

            _logger.LogInformation("Created Foundry agent {Name} ({Id}).", AgentName, agent.Id);
            _agentId = agent.Id;
            return _agentId;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<string?> FindByNameAsync(CancellationToken ct)
    {
        await foreach (PersistentAgent agent in _client.Administration.GetAgentsAsync(cancellationToken: ct))
        {
            if (string.Equals(agent.Name, AgentName, StringComparison.Ordinal))
                return agent.Id;
        }
        return null;
    }

    private const string InstructionsResourceName = "EspacioPro.TelegramAgent.AgentInstructions.md";

    /// <summary>
    /// Static agent instructions, loaded once from the embedded Markdown prompt
    /// (<c>Agent/Foundry/Prompts/telegram-agent.md</c>). Dynamic per-turn context such as the
    /// current date/time is injected by the router into each user message, not here.
    /// </summary>
    private static readonly string Instructions = LoadInstructions();

    private static string LoadInstructions()
    {
        Assembly assembly = typeof(FoundryAgentProvisioner).Assembly;
        using Stream? stream = assembly.GetManifestResourceStream(InstructionsResourceName)
            ?? throw new InvalidOperationException(
                $"Embedded agent instructions resource '{InstructionsResourceName}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
