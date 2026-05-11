namespace EspacioPro.Application.Common;

/// <summary>
/// Canonical Problem Details <c>type</c> URIs per <c>docs/07-api-contract-cheatsheet.md</c> §6.3.
/// Format: <c>urn:espaciopro:problem:&lt;kebab-slug&gt;</c>.
/// </summary>
public static class ProblemTypes
{
    public const string BadRequest          = "urn:espaciopro:problem:bad-request";
    public const string Unauthorized        = "urn:espaciopro:problem:unauthorized";
    public const string Forbidden           = "urn:espaciopro:problem:forbidden";
    public const string NotFound            = "urn:espaciopro:problem:not-found";
    public const string Conflict            = "urn:espaciopro:problem:conflict";
    public const string Duplicate           = "urn:espaciopro:problem:duplicate";
    public const string DependentRecords    = "urn:espaciopro:problem:dependent-records";
    public const string PreconditionFailed  = "urn:espaciopro:problem:precondition-failed";
    public const string Validation          = "urn:espaciopro:problem:validation";
    public const string Internal            = "urn:espaciopro:problem:internal";
}
