namespace EspacioPro.Infrastructure.Cosmos;

/// <summary>
/// Configuration options bound from app settings for Cosmos DB connection.
/// </summary>
public sealed class CosmosOptions
{
    public const string SectionName = "Cosmos";

    /// <summary>
    /// Cosmos DB account endpoint (e.g. https://shared-cosmos-nosql.documents.azure.com:443/).
    /// Required when <see cref="ConnectionString"/> is not provided (production / Managed Identity flow).
    /// </summary>
    public string Endpoint { get; set; } = default!;

    /// <summary>Logical database name (e.g. espaciopro or espaciopro-dev).</summary>
    public string Database { get; set; } = default!;

    /// <summary>
    /// Optional full Cosmos connection string (<c>AccountEndpoint=...;AccountKey=...;</c>).
    /// When set, the client authenticates with the embedded key instead of
    /// <see cref="Azure.Identity.DefaultAzureCredential"/>. Intended for local
    /// development against a real Cosmos dev account when the developer does not
    /// yet have an <c>az login</c> session or RBAC role assigned.
    /// MUST NOT be used in production — Azure deployment relies on Managed Identity
    /// (see <c>docs/02-architecture.md</c>).
    /// </summary>
    public string? ConnectionString { get; set; }
}
