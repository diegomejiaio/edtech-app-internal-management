---
name: dotnet-azure-functions
description: >
  .NET 10 Azure Functions isolated worker backend guidelines for Espacio Pro.
  Trigger: When writing or modifying backend Functions, repositories, domain entities, middleware, or API endpoints.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Creating new HTTP-triggered Functions (endpoints)
- Adding domain entities or modifying existing ones
- Writing Cosmos DB repository methods
- Implementing middleware (auth, correlation, etc.)
- Adding application services or DTOs
- Writing unit/integration tests for the backend

## Stack

.NET 10 | Azure Functions isolated worker | Cosmos DB NoSQL SDK v3 | Clerk JWT (RS256/JWKS) | Managed Identity | System.Text.Json

## Architecture (Clean Architecture layers)

```
backend/
├── src/
│   ├── EspacioPro.Api/              # HTTP triggers, middleware, DI setup
│   │   ├── Functions/               # One class per resource (CRUD)
│   │   ├── Middleware/              # CorrelationId, JwtAuth
│   │   ├── Attributes/             # [RequireRole("admin")]
│   │   ├── Common/                  # ProblemResults extensions
│   │   └── Program.cs              # Host builder, DI registration
│   ├── EspacioPro.Application/      # Abstractions, DTOs, services
│   │   ├── Abstractions/           # ICurrentUser, IClerkJwtValidator
│   │   └── Common/                  # ProblemDetailsFactory, Paginated<T>
│   ├── EspacioPro.Domain/           # Entities, enums, value objects
│   │   ├── Entities/               # Student, Schedule, Enrollment...
│   │   ├── Common/                  # BaseEntity, AuditUser, Enums
│   │   └── Abstractions/           # IRepository<T>
│   └── EspacioPro.Infrastructure/   # Cosmos repos, auth implementation
│       ├── Cosmos/                  # CosmosRepository<T>, concrete repos
│       └── Auth/                    # ClerkJwtValidator, CurrentUserAccessor
└── tests/
    └── EspacioPro.Tests/            # xUnit tests
```

## Critical Rules

| ✅ ALWAYS | ❌ NEVER |
|-----------|----------|
| Inherit `BaseEntity` for all entities | Hard-delete documents |
| Auto-populate audit fields in repository | Mutate audit fields in domain/function code |
| Use `[RequireRole("admin")]` on protected endpoints | Use `AuthorizationLevel.Function` or keys |
| Return RFC 7807 Problem Details on errors | Return plain text or unstructured errors |
| Use `CancellationToken` on all async methods | Ignore cancellation tokens |
| Parameterized queries (`@param`) in Cosmos SQL | String concatenation in queries |
| `camelCase` JSON on the wire | `PascalCase` in API responses |
| Soft delete (`Active = false` + `DeletedAt/By`) | `DeleteItemAsync` |
| One Function class per domain resource | God-class with all endpoints |
| `sealed` on classes that aren't extended | Unsealed concrete classes |
| File-scoped namespaces (`namespace X;`) | Block-scoped namespaces |
| `record` for immutable DTOs/value objects | Mutable classes for DTOs |
| Code and comments in English | Spanish in code |

## Entity Pattern

Every Cosmos document inherits `BaseEntity`:

```csharp
public sealed class Student : BaseEntity
{
    public override string Type => EntityTypes.Student; // "student"

    [JsonPropertyName("firstName")]
    public string FirstName { get; set; } = string.Empty;

    [JsonPropertyName("lastName")]
    public string LastName { get; set; } = string.Empty;

    [JsonPropertyName("docType")]
    public DocType DocType { get; set; }

    [JsonPropertyName("docNumber")]
    public string DocNumber { get; set; } = string.Empty;

    // Override DedupKey for unique constraint (optional)
    public override string DedupKey => $"{EnumToWire(DocType)}:{DocNumber}";
}
```

**Rules:**
- All properties use `[JsonPropertyName("camelCase")]`
- `Type` is abstract override → maps to `EntityTypes` constant
- `DedupKey` override only when entity has natural business key
- No constructor logic — initialization via property defaults
- Enums serialized as camelCase strings (`JsonStringEnumConverter`)

## Repository Pattern

Generic base `CosmosRepository<T>` handles CRUD + audit. Concrete repos add custom queries:

```csharp
public sealed class StudentRepository : CosmosRepository<Student>
{
    protected override string ContainerName => "master";
    protected override string TypeDiscriminator => EntityTypes.Student;

    public StudentRepository(
        CosmosClient cosmosClient,
        IOptions<CosmosOptions> options,
        ICurrentUser currentUser,
        ILogger<StudentRepository> logger)
        : base(cosmosClient, options, currentUser, logger) { }

    /// <summary>Custom query: search by doc number.</summary>
    public async Task<Student?> GetByDocAsync(DocType docType, string docNumber, CancellationToken ct)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = @type AND c.active = true " +
            "AND c.docType = @docType AND c.docNumber = @docNumber")
            .WithParameter("@type", TypeDiscriminator)
            .WithParameter("@docType", EnumWire.ToWire(docType))
            .WithParameter("@docNumber", docNumber);

        // Single-partition read
        using var iterator = Container.GetItemQueryIterator<Student>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(TypeDiscriminator) });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            var result = page.FirstOrDefault();
            if (result is not null) return result;
        }

        return null;
    }
}
```

**Rules:**
- Always filter by `c.type = @type` (partition key)
- Always filter `c.active = true` unless `includeInactive`
- Use parameterized queries — never concatenate values
- Register as `Scoped` in DI (depends on `ICurrentUser`)
- `Container` property exposed for custom queries

## Function (Endpoint) Pattern

One sealed class per resource, all CRUD methods together:

```csharp
public sealed class StudentFunction
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    private readonly StudentRepository _repo;
    private readonly ILogger<StudentFunction> _logger;

    public StudentFunction(StudentRepository repo, ILogger<StudentFunction> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/students — paginated list.</summary>
    [Function("StudentList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/students")] HttpRequest req,
        CancellationToken ct)
    {
        var limit = ClampLimit(req.Query["limit"].FirstOrDefault());
        var offset = Math.Max(0, ParseInt(req.Query["offset"].FirstOrDefault(), 0));

        var (items, total) = await _repo.SearchAsync(/* params */, limit, offset, ct);
        return new OkObjectResult(new Paginated<Student>(items, total, limit, offset));
    }

    /// <summary>GET /api/v1/students/{id}</summary>
    [Function("StudentGetById")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/students/{id}")] HttpRequest req,
        string id, CancellationToken ct)
    {
        var entity = await _repo.GetByIdAsync(id, ct);
        return entity is null
            ? req.NotFound($"Student '{id}' not found.")
            : new OkObjectResult(entity);
    }

    /// <summary>POST /api/v1/students — 201 + Location.</summary>
    [Function("StudentCreate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/students")] HttpRequest req,
        CancellationToken ct)
    {
        var body = await req.ReadFromJsonAsync<StudentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        var entity = MapToEntity(body, new Student());
        var created = await _repo.CreateAsync(entity, ct);

        return new ObjectResult(created) { StatusCode = StatusCodes.Status201Created };
    }

    /// <summary>PUT /api/v1/students/{id} — full replace.</summary>
    [Function("StudentUpdate")]
    [RequireRole("admin")]
    public async Task<IActionResult> Update(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/students/{id}")] HttpRequest req,
        string id, CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Student '{id}' not found.");

        var body = await req.ReadFromJsonAsync<StudentWriteRequest>(ct);
        if (body is null)
            return req.ValidationError("body", "Request body is required.");

        var errors = Validate(body);
        if (errors.Count > 0)
            return req.ValidationError(errors);

        MapToEntity(body, existing);
        var updated = await _repo.UpdateAsync(existing, ct);
        return new OkObjectResult(updated);
    }

    /// <summary>DELETE /api/v1/students/{id} — soft delete, 204.</summary>
    [Function("StudentDelete")]
    [RequireRole("admin")]
    public async Task<IActionResult> Delete(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/students/{id}")] HttpRequest req,
        string id, CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null)
            return req.NotFound($"Student '{id}' not found.");

        await _repo.SoftDeleteAsync(id, ct);
        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }
}
```

## Error Handling (RFC 7807)

Use `ProblemResults` extension methods on `HttpRequest`:

```csharp
// Validation (422)
return req.ValidationError("field", "message");
return req.ValidationError(errorsDict); // IDictionary<string, string[]>

// Not found (404)
return req.NotFound($"Student '{id}' not found.");

// Conflict (409)
return req.Conflict("Cannot delete: has active enrollments.");
return req.Duplicate("A student with DNI 12345678 already exists.");
return req.DependentRecords("Student has 3 active enrollments.");
```

**Response shape** (`application/problem+json`):
```json
{
  "type": "https://httpstatuses.io/422",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/api/v1/students",
  "correlationId": "abc-123",
  "errors": { "docNumber": ["Document number is required."] }
}
```

## Pagination

Standard envelope via `Paginated<T>` record:

```csharp
// Response shape: { items: [...], total: 42, limit: 25, offset: 0 }
return new OkObjectResult(new Paginated<Student>(items, total, limit, offset));
```

Query params: `?limit=25&offset=0&sort=createdAt:desc`
- Default limit: 25, max: 100
- Always return `total` count for UI pagination

## Middleware Pipeline (order matters)

```
1. CorrelationIdMiddleware  → reads/generates x-correlation-id
2. JwtAuthMiddleware        → validates Clerk JWT, enforces [RequireRole]
```

## DI Registration (Program.cs)

```csharp
// Options
services.Configure<CosmosOptions>(opts => { /* from config */ });
services.Configure<ClerkOptions>(opts => { /* from config */ });

// Cosmos client — singleton (thread-safe)
services.AddSingleton<CosmosClient>(sp => CosmosClientFactory.Create(options));

// Auth — singleton validator, scoped user accessor
services.AddSingleton<IClerkJwtValidator, ClerkJwtValidator>();
services.AddScoped<ICurrentUser, CurrentUserAccessor>();

// Repositories — scoped (depend on ICurrentUser per-request)
services.AddScoped<StudentRepository>();
```

## Cosmos DB Rules

| Rule | Detail |
|------|--------|
| Partition key | `/type` — all queries must filter by `c.type = @type` |
| ID format | `Guid.NewGuid().ToString("D")` — generated in `CreateAsync` |
| Containers | `master` (catalogs, students, teachers, schedules), `operations` (enrollments, payments, expenses) |
| Auth (prod) | Managed Identity → `DefaultAzureCredential` |
| Auth (local) | `az login` → `DefaultAzureCredential` (preferred) or `COSMOS_CONNECTION_STRING` fallback |
| Ordering | Default `ORDER BY c.updatedAt DESC, c.createdAt DESC` |
| Composite index | Required for any multi-field ORDER BY |
| Unique keys | `/type` + `/dedupKey` per container — enforced at creation |
| ETags | Used for optimistic concurrency on `UpdateAsync` when entity has `ETag` |

## Auth Pattern

```csharp
// Attribute on function method (not class)
[RequireRole("admin")]

// Clerk JWT claims required:
// - sub (user id)
// - email
// - name (display name)
// - role OR o.rol (organization role)

// ICurrentUser interface — injected into repositories
public interface ICurrentUser
{
    string ClerkUserId { get; }
    string Email { get; }
    string DisplayName { get; }
    AuditUser ToAuditUser();
}
```

## JSON Serialization

Global config in `Program.cs`:

```csharp
services.Configure<JsonSerializerOptions>(opts =>
{
    opts.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    opts.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    opts.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    opts.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    opts.Converters.Add(new TimeOnlyHHmmJsonConverter());
});
```

- Enums: camelCase strings on wire (`active`, `inProgress`)
- Dates: ISO 8601 UTC strings (`DateTime.UtcNow.ToString("o")`)
- Times: `HH:mm` format via custom converter
- Nulls: omitted from response (`WhenWritingNull`)

## Testing

xUnit with test classes per domain area:

```csharp
public sealed class StudentEntityTests
{
    [Fact]
    public void DedupKey_Returns_DocType_DocNumber()
    {
        var student = new Student { DocType = DocType.Dni, DocNumber = "12345678" };
        Assert.Equal("dni:12345678", student.DedupKey);
    }
}
```

**Rules:**
- Test file per logical area (not per class)
- `sealed` on test classes
- Arrange-Act-Assert pattern
- No mocking frameworks in v1 — unit test domain logic directly

## Adding a New Endpoint (Checklist)

1. **Entity** → `Domain/Entities/NewEntity.cs` inheriting `BaseEntity`
2. **EntityTypes** → add constant `public const string NewEntity = "newEntity";`
3. **Repository** → `Infrastructure/Cosmos/Repositories/NewEntityRepository.cs`
4. **Register repo** → `Program.cs` `services.AddScoped<NewEntityRepository>()`
5. **Function** → `Api/Functions/NewEntityFunction.cs` with CRUD methods
6. **Write request DTO** → private `record` inside Function class (or in Application/Common)
7. **Validation** → private `Validate()` method returning `Dictionary<string, string[]>`
8. **Tests** → `Tests/Entities/NewEntityTests.cs`

## Commands

```bash
# Run locally (from backend/)
./run.sh
# or manually:
cd src/EspacioPro.Api && func start

# Run tests
dotnet test

# Build
dotnet build

# Add package
dotnet add src/EspacioPro.Api/EspacioPro.Api.csproj package <PackageName>
```

## Anti-Patterns

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Application/Service layer with complex orchestration | Put logic directly in Function methods (v1 is simple CRUD) |
| MediatR, CQRS, event sourcing | Direct repository calls (premature for v1) |
| AutoMapper | Manual `MapToEntity()` private methods |
| FluentValidation package | Simple `Validate()` method returning error dict |
| `IRepository<T>` interface injection | Concrete repository injection (swap to interface when >1 impl needed) |
| `HttpClient` for Cosmos | Cosmos SDK v3 with `CosmosClient` singleton |
| Throwing exceptions for control flow | Return `IActionResult` with ProblemDetails |
| Multiple response DTOs | Return entity directly (small docs, no over-fetching in v1) |
