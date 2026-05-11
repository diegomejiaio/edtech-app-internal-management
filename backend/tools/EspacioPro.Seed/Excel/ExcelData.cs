namespace EspacioPro.Seed.Excel;

/// <summary>
/// Raw row records mirroring the headers of <c>tmp/ESPACIO_PRO_SYSTEM.xlsx</c>.
/// All foreign keys are kept as legacy Excel ids (e.g. <c>PRF-0001</c>) and resolved to
/// new GUIDs by the seeders via <see cref="EspacioPro.Seed.SeedContext"/>.
/// </summary>
internal static class ExcelSheets
{
    public const string MasterData    = "Datos Maestros";
    public const string Teachers      = "Profesores";
    public const string Students      = "Alumnos";
    public const string Schedules     = "Horarios";
    public const string Enrollments   = "Inscripciones";
    public const string Payments      = "Pagos";
    public const string Expenses      = "Gastos";
}

internal sealed record ExcelTeacher(
    string ExcelId,
    string FullName,
    string DocNumber,
    string? Phone,
    string? Email,
    string? Specialty,
    DateTime? RegisteredAt);

internal sealed record ExcelStudent(
    string ExcelId,
    string FullName,
    string DocNumber,
    string? Phone,
    string? Email,
    DateTime? RegisteredAt,
    string? Source,
    string? Notes);

internal sealed record ExcelSchedule(
    string ExcelId,
    string Course,
    string Level,
    string TeacherExcelId,
    string TeacherName,
    string DaysLabel,
    TimeOnly StartTime,
    TimeOnly EndTime,
    decimal Price,
    int Capacity,
    string Status,
    DateOnly StartDate);

internal sealed record ExcelEnrollment(
    string ExcelId,
    string StudentExcelId,
    string StudentName,
    string ScheduleExcelId,
    string ScheduleLabel,
    DateOnly EnrollmentDate,
    string Status);

internal sealed record ExcelPayment(
    string ExcelId,
    string EnrollmentExcelId,
    string StudentName,
    string ScheduleLabel,
    DateOnly Date,
    decimal Amount,
    int InstallmentNumber,
    string PaymentMethod,
    bool HasReceipt,
    string? ReceiptNumber,
    string? Notes);

internal sealed record ExcelExpense(
    string ExcelId,
    DateOnly Date,
    string Category,
    string Description,
    decimal Amount,
    string PaymentMethod,
    string? Notes,
    string? ScheduleExcelId);

/// <summary>
/// Catalog rows from the "Datos Maestros" sheet, normalized into one entry per
/// catalog code. Preserves original Excel order so seeded items keep that order.
/// </summary>
internal sealed record ExcelCatalog(string Code, IReadOnlyList<string> Items);
