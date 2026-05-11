namespace EspacioPro.Domain.Abstractions;

using EspacioPro.Domain.Common;

/// <summary>
/// Generic repository contract for Cosmos DB documents.
/// Implementation lives in Infrastructure.
/// </summary>
public interface IRepository<T> where T : BaseEntity
{
    /// <summary>Point-read a document by id within its partition.</summary>
    Task<T?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>List documents of type <typeparamref name="T"/>.</summary>
    Task<IReadOnlyList<T>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default);

    /// <summary>Create a new document. Audit fields are set by the implementation.</summary>
    Task<T> CreateAsync(T entity, CancellationToken ct = default);

    /// <summary>Full-replace update. Audit fields are set by the implementation.</summary>
    Task<T> UpdateAsync(T entity, CancellationToken ct = default);

    /// <summary>Soft-delete: sets Active=false, DeletedAt/DeletedBy. Never hard-deletes.</summary>
    Task SoftDeleteAsync(string id, CancellationToken ct = default);
}
