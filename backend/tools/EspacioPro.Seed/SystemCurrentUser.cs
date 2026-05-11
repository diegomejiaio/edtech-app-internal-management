using EspacioPro.Application.Abstractions;
using EspacioPro.Domain.Common;

namespace EspacioPro.Seed;

/// <summary>
/// Synthetic <see cref="ICurrentUser"/> used by the seeder when no JWT is present.
/// All seeded documents will carry this audit snapshot.
/// </summary>
internal sealed class SystemCurrentUser : ICurrentUser
{
    public AuditUser? GetAuditUser() => new(
        ClerkUserId: "system",
        Email: "system@espaciopro.local",
        DisplayName: "Catalog Seeder");
}
