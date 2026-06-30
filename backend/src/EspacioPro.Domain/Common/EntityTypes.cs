namespace EspacioPro.Domain.Common;

/// <summary>
/// Canonical Cosmos <c>type</c> discriminator values per <c>docs/01-domain-model.md</c> §10
/// and <c>docs/07-api-contract-cheatsheet.md</c> §3.
/// Format: camelCase, singular, no underscores.
/// </summary>
public static class EntityTypes
{
    public const string Catalog = "catalog";
    public const string Student = "student";
    public const string Teacher = "teacher";
    public const string Schedule = "schedule";
    public const string Enrollment = "enrollment";
    public const string StudentPayment = "studentPayment";
    public const string TeacherPayment = "teacherPayment";
    public const string Expense = "expense";
    public const string AgentThread = "agentThread";

    // WhatsApp CRM (MVP) — container "whatsapp". See docs/10-whatsapp-crm-mvp.md §1.
    public const string Conversation = "conversation";
    public const string Message = "message";
    public const string Lead = "lead";
    public const string WaConfig = "waConfig";
}

/// <summary>
/// Cosmos container names per <c>docs/02-architecture.md</c>.
/// </summary>
public static class ContainerNames
{
    public const string Master = "master";
    public const string Operations = "operations";

    /// <summary>WhatsApp CRM container (conversations, messages, leads, config). PK <c>/type</c>.</summary>
    public const string WhatsApp = "whatsapp";
}
