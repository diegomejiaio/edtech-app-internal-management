using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

namespace EspacioPro.Infrastructure.Cosmos;

/// <summary>
/// Builds the singleton <see cref="CosmosClient"/>.
/// <para>
/// Authentication mode is resolved at startup:
/// <list type="bullet">
///   <item><description>If <see cref="CosmosOptions.ConnectionString"/> is set
///   (typically in <c>local.settings.json</c> for developers without an
///   <c>az login</c> session yet), the embedded account key is used.</description></item>
///   <item><description>Otherwise <see cref="DefaultAzureCredential"/> is used —
///   Managed Identity in Azure, <c>az login</c> locally. This is the production path.</description></item>
/// </list>
/// </para>
/// <para>
/// Uses System.Text.Json so <c>[JsonPropertyName]</c> and <c>[JsonIgnore]</c>
/// attributes on domain entities are respected by Cosmos serialization.
/// </para>
/// </summary>
public static class CosmosClientFactory
{
    public static CosmosClient Create(CosmosOptions options)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(options.Database);

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        jsonOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));

        var clientOptions = new CosmosClientOptions
        {
            UseSystemTextJsonSerializerWithOptions = jsonOptions,
            ConnectionMode = ResolveConnectionMode(options.ConnectionMode),
            ApplicationName = "EspacioPro"
        };

        if (!string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            return new CosmosClient(options.ConnectionString, clientOptions);
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(options.Endpoint);
        var credential = new DefaultAzureCredential();
        return new CosmosClient(options.Endpoint, credential, clientOptions);
    }

    private static ConnectionMode ResolveConnectionMode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return ConnectionMode.Direct;

        if (string.Equals(value, nameof(ConnectionMode.Gateway), StringComparison.OrdinalIgnoreCase))
            return ConnectionMode.Gateway;

        if (string.Equals(value, nameof(ConnectionMode.Direct), StringComparison.OrdinalIgnoreCase))
            return ConnectionMode.Direct;

        throw new ArgumentException("COSMOS_CONNECTION_MODE must be 'Direct' or 'Gateway'.", nameof(value));
    }
}
