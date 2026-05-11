namespace EspacioPro.Domain.Common;

/// <summary>
/// Immutable snapshot of the acting user captured at write time.
/// Populated from Clerk JWT claims — never resolved by lookup.
/// </summary>
public sealed record AuditUser(string ClerkUserId, string Email, string DisplayName);
