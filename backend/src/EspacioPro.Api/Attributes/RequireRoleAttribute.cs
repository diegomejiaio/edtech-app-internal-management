namespace EspacioPro.Api.Attributes;

/// <summary>
/// Declarative role gate for Azure Functions endpoints.
/// The <see cref="Middleware.JwtAuthMiddleware"/> reads this attribute
/// to enforce role-based access from the validated JWT's <c>role</c> claim.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireRoleAttribute : Attribute
{
    /// <summary>The required role claim value (e.g. "admin").</summary>
    public string Role { get; }

    public RequireRoleAttribute(string role)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(role);
        Role = role;
    }
}
