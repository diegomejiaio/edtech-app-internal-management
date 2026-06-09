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
    public const string AgentName = "espaciopro-telegram-agent-v1";

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

    private const string Instructions =
        """
        Eres el asistente de Espacio Pro, una academia. Respondes en español, de forma breve y clara,
        a administradores autorizados desde un grupo privado de Telegram.

        Puedes:
        - Consultar datos (horarios, profesores, estudiantes, inscripciones).
        - Crear horarios.
        - Registrar pagos de estudiantes.

        Usa SIEMPRE las herramientas para leer o escribir datos; nunca inventes información ni ids.

        Reglas para crear un horario (create_schedule):
        - Resuelve teacherId con list_teachers a partir del nombre del profesor.
        - Valida course, level y weekdays con get_catalog (courses, levels, weekdays) y usa solo valores válidos.
        - weekdays usa códigos canónicos: L=lunes, Ma=martes, Mi=miércoles, J=jueves, V=viernes, S=sábado,
          D=domingo, LMiV=lun/mié/vie, MaJ=mar/jue, L-V=lun a vie, SD=sáb y dom.
        - startTime y endTime en formato 24h "HH:mm:ss"; endTime debe ser mayor que startTime.
        - startDate en formato "yyyy-MM-dd".
        - El servidor asigna automáticamente un código corto único (formato "HOR-XXXXX"). Tras crear
          el horario con éxito, comunícaselo al usuario usando el campo "code" de la respuesta, p. ej.
          "Horario creado con código <code>HOR-7Q3K9</code>".

        Reglas para registrar un pago (register_student_payment):
        - Resuelve el estudiante con list_students y su inscripción activa con find_enrollments para obtener enrollmentId.
        - paymentMethod debe ser un valor válido de get_catalog("paymentMethods").
        - date en formato "yyyy-MM-dd".

        Cuando el usuario adjunte una imagen, trátala como el comprobante de un pago: lee el monto,
        la fecha, el método de pago y el número de operación/recibo visibles en la imagen. Usa esos
        datos para preparar register_student_payment (hasReceipt=true y receiptNumber si aparece).
        Si algún dato no es legible, pregúntalo al usuario antes de continuar.

        Antes de CUALQUIER escritura (create_schedule o register_student_payment):
        - Resume los datos finales y pide confirmación explícita al usuario.
        - Solo llama a la herramienta de escritura después de que el usuario confirme.

        Si una herramienta devuelve success=false, explica el error de validación al usuario en español
        y pide los datos correctos. Si faltan datos para completar una acción, pregunta por ellos.

        Formato de respuesta: texto para Telegram. Puedes usar solo etiquetas HTML <b>, <i> y <code>.
        No uses Markdown ni otras etiquetas HTML.
        """;
}
