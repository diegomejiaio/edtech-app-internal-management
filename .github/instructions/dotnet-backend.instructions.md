---
applyTo: "backend/**"
---

# .NET Backend Guidelines

## Architecture

Clean Architecture: Api → Application → Domain → Infrastructure.

## Patterns

- **Entities**: inherit `BaseEntity`, override `Type`, use `[JsonPropertyName("camelCase")]`.
- **Repositories**: inherit `CosmosRepository<T>`, always filter by `c.type = @type`.
- **Functions**: one sealed class per resource, CRUD methods with `[RequireRole("admin")]`.
- **Errors**: RFC 7807 via `ProblemResults` extension methods on `HttpRequest`.
- **Pagination**: `Paginated<T>` record, `?limit=25&offset=0`.

## Rules

- `sealed` on all concrete classes not intended for inheritance.
- File-scoped namespaces (`namespace X;`).
- `record` for immutable DTOs and value objects.
- `CancellationToken` on all async methods.
- Parameterized Cosmos queries (`@param`), never string concatenation.
- No hard deletes — always soft delete via `SoftDeleteAsync`.
- Audit fields auto-populated by repository — never mutate in domain code.
- Direct repository calls, no MediatR/CQRS in v1.

## Commands

```bash
cd backend && ./run.sh        # Local dev (func start on :7071)
dotnet test                   # Run tests
dotnet build                  # Build
```
