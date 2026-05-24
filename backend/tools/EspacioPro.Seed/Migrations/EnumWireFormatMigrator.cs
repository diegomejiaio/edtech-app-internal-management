using EspacioPro.Domain.Common;
using EspacioPro.Infrastructure.Cosmos;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Seed.Migrations;

/// <summary>
/// One-time, idempotent migration for documents written before enum fields were
/// stored as camelCase strings in Cosmos DB.
/// </summary>
internal sealed class EnumWireFormatMigrator
{
    private readonly Database _database;
    private readonly ILogger<EnumWireFormatMigrator> _logger;

    public EnumWireFormatMigrator(
        CosmosClient client,
        IOptions<CosmosOptions> options,
        ILogger<EnumWireFormatMigrator> logger)
    {
        _database = client.GetDatabase(options.Value.Database);
        _logger = logger;
    }

    public async Task<MigrationResult> RunAsync(bool apply, CancellationToken ct = default)
    {
        var total = MigrationResult.Empty;

        total += await MigrateDocTypeAsync(
            _database.GetContainer(ContainerNames.Master),
            EntityTypes.Student,
            apply,
            ct);

        total += await MigrateDocTypeAsync(
            _database.GetContainer(ContainerNames.Master),
            EntityTypes.Teacher,
            apply,
            ct);

        total += await MigrateStatusAsync<ScheduleStatus>(
            _database.GetContainer(ContainerNames.Master),
            EntityTypes.Schedule,
            apply,
            ct);

        total += await MigrateStatusAsync<EnrollmentStatus>(
            _database.GetContainer(ContainerNames.Operations),
            EntityTypes.Enrollment,
            apply,
            ct);

        return total;
    }

    private async Task<MigrationResult> MigrateDocTypeAsync(
        Container container,
        string type,
        bool apply,
        CancellationToken ct)
    {
        var query = new QueryDefinition("""
            SELECT c.id, c.type, c.docType AS enumValue
            FROM c
            WHERE c.type = @type
              AND IS_NUMBER(c.docType)
            """)
            .WithParameter("@type", type);

        return await MigrateFieldAsync<DocType>(
            container,
            type,
            "docType",
            query,
            apply,
            ct);
    }

    private async Task<MigrationResult> MigrateStatusAsync<TEnum>(
        Container container,
        string type,
        bool apply,
        CancellationToken ct)
        where TEnum : struct, Enum
    {
        var query = new QueryDefinition("""
            SELECT c.id, c.type, c.status AS enumValue
            FROM c
            WHERE c.type = @type
              AND IS_NUMBER(c.status)
            """)
            .WithParameter("@type", type);

        return await MigrateFieldAsync<TEnum>(
            container,
            type,
            "status",
            query,
            apply,
            ct);
    }

    private async Task<MigrationResult> MigrateFieldAsync<TEnum>(
        Container container,
        string type,
        string fieldName,
        QueryDefinition query,
        bool apply,
        CancellationToken ct)
        where TEnum : struct, Enum
    {
        var scanned = 0;
        var updated = 0;

        using var iterator = container.GetItemQueryIterator<EnumTarget>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(type) });

        while (iterator.HasMoreResults)
        {
            foreach (var target in await iterator.ReadNextAsync(ct))
            {
                scanned++;
                if (!TryConvert<TEnum>(target.EnumValue, out var wireValue))
                {
                    _logger.LogWarning(
                        "{Container}/{Type}/{Id}: cannot map numeric {Field}={Value}; skipped.",
                        container.Id,
                        target.Type,
                        target.Id,
                        fieldName,
                        target.EnumValue);
                    continue;
                }

                _logger.LogInformation(
                    "{Mode} {Container}/{Type}/{Id}: {Field} {OldValue} -> {NewValue}",
                    apply ? "Patch" : "Would patch",
                    container.Id,
                    target.Type,
                    target.Id,
                    fieldName,
                    target.EnumValue,
                    wireValue);

                if (apply)
                {
                    await container.PatchItemAsync<dynamic>(
                        target.Id,
                        new PartitionKey(target.Type),
                        [PatchOperation.Set($"/{fieldName}", wireValue)],
                        cancellationToken: ct);
                }

                updated++;
            }
        }

        if (scanned == 0)
        {
            _logger.LogInformation("{Container}/{Type}: no numeric {Field} values found.", container.Id, type, fieldName);
        }

        return new MigrationResult(scanned, updated);
    }

    private static bool TryConvert<TEnum>(int numericValue, out string wireValue)
        where TEnum : struct, Enum
    {
        var enumValue = (TEnum)Enum.ToObject(typeof(TEnum), numericValue);
        if (!Enum.IsDefined(enumValue))
        {
            wireValue = string.Empty;
            return false;
        }

        wireValue = EnumWire.ToCamel(enumValue);
        return true;
    }

    private sealed record EnumTarget(string Id, string Type, int EnumValue);
}

internal readonly record struct MigrationResult(int Scanned, int Updated)
{
    public static MigrationResult Empty => new(0, 0);

    public static MigrationResult operator +(MigrationResult left, MigrationResult right) =>
        new(left.Scanned + right.Scanned, left.Updated + right.Updated);
}
