using EspacioPro.Api.Attributes;
using EspacioPro.Api.Common;
using EspacioPro.Domain.Entities;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Catalog CRUD endpoints per <c>docs/04-api-design.md §5.1</c>.
/// All endpoints require <c>[RequireRole("admin")]</c>.
/// </summary>
public sealed class CatalogFunction
{
    private readonly CatalogRepository _repo;
    private readonly ILogger<CatalogFunction> _logger;

    public CatalogFunction(CatalogRepository repo, ILogger<CatalogFunction> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    /// <summary>GET /api/v1/catalogs — list all catalog documents.</summary>
    [Function("CatalogList")]
    [RequireRole("admin")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/catalogs")] HttpRequest req,
        CancellationToken ct)
    {
        var catalogs = await _repo.GetAllAsync(includeInactive: false, ct);
        return new OkObjectResult(catalogs);
    }

    /// <summary>GET /api/v1/catalogs/{code} — get single catalog by code.</summary>
    [Function("CatalogGetByCode")]
    [RequireRole("admin")]
    public async Task<IActionResult> GetByCode(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/catalogs/{code}")] HttpRequest req,
        string code,
        CancellationToken ct)
    {
        var catalog = await _repo.GetByCodeAsync(code, ct);
        if (catalog is null)
            return req.NotFound($"Catalog '{code}' not found.");

        return new OkObjectResult(catalog);
    }

    /// <summary>PUT /api/v1/catalogs/{code} — replace the items array.</summary>
    [Function("CatalogReplaceItems")]
    [RequireRole("admin")]
    public async Task<IActionResult> ReplaceItems(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "v1/catalogs/{code}")] HttpRequest req,
        string code,
        CancellationToken ct)
    {
        var catalog = await _repo.GetByCodeAsync(code, ct);
        if (catalog is null)
            return req.NotFound($"Catalog '{code}' not found.");

        var body = await req.ReadFromJsonAsync<CatalogReplaceRequest>(ct);
        if (body?.Items is null || body.Items.Count == 0)
            return req.ValidationError("items", "Request body must include a non-empty 'items' array.");

        catalog.Items = body.Items;
        var updated = await _repo.UpdateAsync(catalog, ct);

        return new OkObjectResult(updated);
    }

    /// <summary>POST /api/v1/catalogs/{code}/items — append a new item.</summary>
    [Function("CatalogAddItem")]
    [RequireRole("admin")]
    public async Task<IActionResult> AddItem(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/catalogs/{code}/items")] HttpRequest req,
        string code,
        CancellationToken ct)
    {
        var catalog = await _repo.GetByCodeAsync(code, ct);
        if (catalog is null)
            return req.NotFound($"Catalog '{code}' not found.");

        var body = await req.ReadFromJsonAsync<CatalogAddItemRequest>(ct);
        if (string.IsNullOrWhiteSpace(body?.Value))
            return req.ValidationError("value", "'value' is required.");

        if (catalog.Items.Any(i => i.Value.Equals(body.Value, StringComparison.OrdinalIgnoreCase)))
            return req.Duplicate($"Item '{body.Value}' already exists in catalog '{code}'.");

        var maxOrder = catalog.Items.Count > 0 ? catalog.Items.Max(i => i.Order) : 0;
        catalog.Items.Add(new CatalogItem
        {
            Value = body.Value,
            Order = body.Order ?? maxOrder + 1,
            Active = true
        });

        var updated = await _repo.UpdateAsync(catalog, ct);

        return new ObjectResult(updated) { StatusCode = StatusCodes.Status201Created };
    }

    /// <summary>DELETE /api/v1/catalogs/{code}/items/{value} — soft-disable an item.</summary>
    [Function("CatalogDisableItem")]
    [RequireRole("admin")]
    public async Task<IActionResult> DisableItem(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/catalogs/{code}/items/{value}")] HttpRequest req,
        string code,
        string value,
        CancellationToken ct)
    {
        var catalog = await _repo.GetByCodeAsync(code, ct);
        if (catalog is null)
            return req.NotFound($"Catalog '{code}' not found.");

        var item = catalog.Items.FirstOrDefault(i =>
            i.Value.Equals(value, StringComparison.OrdinalIgnoreCase) && i.Active);

        if (item is null)
            return req.NotFound($"Active item '{value}' not found in catalog '{code}'.");

        item.Active = false;
        await _repo.UpdateAsync(catalog, ct);

        return new StatusCodeResult(StatusCodes.Status204NoContent);
    }

    // --- Request DTOs (inline, simple enough for v1) ---

    private sealed record CatalogReplaceRequest(List<CatalogItem> Items);
    private sealed record CatalogAddItemRequest(string Value, int? Order);
}
