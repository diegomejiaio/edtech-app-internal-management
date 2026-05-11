using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;
using EspacioPro.Domain.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EspacioPro.Infrastructure.Cosmos.Repositories;

/// <summary>
/// Cosmos repository for <see cref="Student"/> documents in the <c>master</c> container.
/// Mirrors <see cref="TeacherRepository"/> pattern: dedup by doc + paginated search.
/// </summary>
public sealed class StudentRepository : CosmosRepository<Student>
{
    protected override string ContainerName => ContainerNames.Master;
    protected override string TypeDiscriminator => EntityTypes.Student;

    public StudentRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<StudentRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>
    /// Finds an active student by <c>docType + docNumber</c>. Used for dedup on POST/PUT.
    /// </summary>
    public async Task<Student?> GetByDocAsync(DocType docType, string docNumber, CancellationToken ct = default)
    {
        // Stored value matches JsonStringEnumConverter(camelCase) output (see Program.cs).
        var docTypeWire = char.ToLowerInvariant(docType.ToString()[0]) + docType.ToString()[1..];

        var query = new QueryDefinition(@"
            SELECT * FROM c
             WHERE c.type = @type
               AND c.active = true
               AND c.docType = @docType
               AND c.docNumber = @docNumber")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@docType", docTypeWire)
            .WithParameter("@docNumber", docNumber);

        using var iterator = Container.GetItemQueryIterator<Student>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            var student = page.FirstOrDefault();
            if (student is not null)
            {
                student.ETag = page.ETag;
                return student;
            }
        }

        return null;
    }

    /// <summary>
    /// Lists students with optional substring search on first/last name or doc number,
    /// optional <paramref name="docType"/> filter, optional <paramref name="source"/> filter, and pagination.
    /// Per <c>docs/04-api-design.md</c> §5.2.
    /// </summary>
    public async Task<(IReadOnlyList<Student> Items, int Total)> SearchAsync(
        string? search,
        DocType? docType,
        string? source,
        bool includeInactive,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var where = "c.type = @type" + (includeInactive ? "" : " AND c.active = true");
        var hasSearch = !string.IsNullOrWhiteSpace(search);
        var hasSource = !string.IsNullOrWhiteSpace(source);

        if (hasSearch)
            where += " AND (CONTAINS(LOWER(c.firstName), @search) OR CONTAINS(LOWER(c.lastName), @search) OR CONTAINS(LOWER(c.docNumber), @search))";
        if (docType is not null)
            where += " AND c.docType = @docType";
        if (hasSource)
            where += " AND c.source = @source";

        var countDef = new QueryDefinition($"SELECT VALUE COUNT(1) FROM c WHERE {where}");
        var pageDef = new QueryDefinition(
            $"SELECT * FROM c WHERE {where} ORDER BY c.lastName, c.firstName OFFSET @offset LIMIT @limit");

        countDef.WithParameter("@type", TypeDiscriminator);
        pageDef.WithParameter("@type", TypeDiscriminator)
               .WithParameter("@offset", offset)
               .WithParameter("@limit", limit);

        if (hasSearch)
        {
            countDef.WithParameter("@search", search!.ToLowerInvariant());
            pageDef.WithParameter("@search", search!.ToLowerInvariant());
        }
        if (docType is not null)
        {
            var docTypeWire = char.ToLowerInvariant(docType.Value.ToString()[0]) + docType.Value.ToString()[1..];
            countDef.WithParameter("@docType", docTypeWire);
            pageDef.WithParameter("@docType", docTypeWire);
        }
        if (hasSource)
        {
            countDef.WithParameter("@source", source);
            pageDef.WithParameter("@source", source);
        }

        var partitionOpts = new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) };

        var total = 0;
        using (var countIter = Container.GetItemQueryIterator<int>(countDef, requestOptions: partitionOpts))
        {
            while (countIter.HasMoreResults)
            {
                var page = await countIter.ReadNextAsync(ct);
                total += page.Sum();
            }
        }

        var items = new List<Student>(limit);
        using var iter = Container.GetItemQueryIterator<Student>(pageDef, requestOptions: partitionOpts);
        while (iter.HasMoreResults)
        {
            var page = await iter.ReadNextAsync(ct);
            foreach (var student in page)
            {
                student.ETag = page.ETag;
                items.Add(student);
            }
        }

        return (items, total);
    }
}
