using System.Text.RegularExpressions;
using EspacioPro.Domain.Common;

namespace EspacioPro.Domain.Common;

/// <summary>
/// Per <c>docs/01-domain-model.md</c> §3.2 / §3.3.
/// Validates a document number against its <see cref="DocType"/>.
/// </summary>
public static partial class DocumentValidation
{
    [GeneratedRegex(@"^\d{8}$")]
    private static partial Regex DniRegex();

    [GeneratedRegex(@"^[A-Za-z0-9]{9,20}$")]
    private static partial Regex CeRegex();

    [GeneratedRegex(@"^[A-Za-z0-9]{6,20}$")]
    private static partial Regex PassportRegex();

    public static bool IsValid(DocType docType, string? docNumber) =>
        !string.IsNullOrWhiteSpace(docNumber) && docType switch
        {
            DocType.Dni      => DniRegex().IsMatch(docNumber),
            DocType.Ce       => CeRegex().IsMatch(docNumber),
            DocType.Passport => PassportRegex().IsMatch(docNumber),
            _ => false
        };

    public static string ErrorMessage(DocType docType) => docType switch
    {
        DocType.Dni      => "DNI must be exactly 8 digits.",
        DocType.Ce       => "CE must be 9–20 alphanumeric characters.",
        DocType.Passport => "Passport must be 6–20 alphanumeric characters.",
        _ => "Invalid document type."
    };
}

/// <summary>
/// RFC 5322 minimal email validator. Per <c>docs/01-domain-model.md</c> §3.2.
/// </summary>
public static partial class EmailValidation
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    public static bool IsValid(string? email) =>
        string.IsNullOrEmpty(email) || EmailRegex().IsMatch(email);
}
