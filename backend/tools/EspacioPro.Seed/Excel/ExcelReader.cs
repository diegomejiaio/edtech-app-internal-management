using System.IO.Compression;
using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace EspacioPro.Seed.Excel;

/// <summary>
/// Reads <c>ESPACIO_PRO_SYSTEM.xlsx</c> into typed POCOs. One instance per file.
/// All cells are parsed defensively: blank rows are skipped, numeric values that
/// the source treats as strings (DNI, phone) are normalized, and date cells fall
/// back to string parsing when the worksheet was never opened in Excel.
/// </summary>
internal sealed class ExcelReader : IDisposable
{
    private readonly XLWorkbook _wb;
    private readonly string? _tempCopyPath;

    public ExcelReader(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"Excel source not found: {path}", path);

        // Workaround for ClosedXML #1855: workbooks containing data validation
        // rules with values longer than 255 chars (typical for long dropdown
        // formulas or named ranges) throw on load. We copy the .xlsx to a temp
        // file, strip every <dataValidations> block from each worksheet's XML
        // (UI metadata only — does not touch cell values), then open the copy.
        _tempCopyPath = SanitizeWorkbookCopy(path);
        _wb = new XLWorkbook(_tempCopyPath);
    }

    private static string SanitizeWorkbookCopy(string sourcePath)
    {
        var tempPath = Path.Combine(
            Path.GetTempPath(),
            $"espaciopro-seed-{Guid.NewGuid():N}.xlsx");
        File.Copy(sourcePath, tempPath, overwrite: true);

        using var zip = ZipFile.Open(tempPath, ZipArchiveMode.Update);
        var sheetEntries = zip.Entries
            .Where(e => e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase)
                        && e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var entry in sheetEntries)
        {
            string xml;
            using (var reader = new StreamReader(entry.Open()))
                xml = reader.ReadToEnd();

            var stripped = Regex.Replace(
                xml,
                @"<dataValidations\b[^>]*>.*?</dataValidations>",
                string.Empty,
                RegexOptions.Singleline | RegexOptions.IgnoreCase);
            stripped = Regex.Replace(
                stripped,
                @"<dataValidations\b[^/]*/>",
                string.Empty,
                RegexOptions.IgnoreCase);

            if (stripped == xml) continue;

            using var writer = new StreamWriter(entry.Open());
            writer.BaseStream.SetLength(0);
            writer.Write(stripped);
        }

        return tempPath;
    }

    public IReadOnlyList<ExcelCatalog> ReadCatalogs()
    {
        // The "Datos Maestros" sheet stores 8 catalogs in parallel columns
        // (separated by blank columns). Header row defines each column's catalog
        // code; data continues downward until a blank cell.
        var ws = GetSheet(ExcelSheets.MasterData);
        var headers = ws.Row(1).CellsUsed().ToList();

        // Map Spanish header → backend catalog code. enrollmentStatuses and
        // scheduleStatuses are intentionally skipped (they map to code-level
        // enums, not stored catalogs).
        var headerMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Cursos"]              = "courses",
            ["Niveles"]             = "levels",
            ["Medios de Pago"]      = "paymentMethods",
            ["Categorias Gasto"]    = "expenseCategories",
            ["Dias Horario"]        = "weekdays",
            ["Fuente"]              = "studentSources",
        };

        var catalogs = new List<ExcelCatalog>();
        foreach (var header in headers)
        {
            var label = header.GetString().Trim();
            if (!headerMap.TryGetValue(label, out var code)) continue;

            var col = header.Address.ColumnNumber;
            var items = new List<string>();
            var row = 2;
            while (true)
            {
                var cell = ws.Cell(row, col);
                if (cell.IsEmpty()) break;
                var v = cell.GetString().Trim();
                if (!string.IsNullOrEmpty(v)) items.Add(v);
                row++;
            }
            if (items.Count > 0) catalogs.Add(new ExcelCatalog(code, items));
        }
        return catalogs;
    }

    public IReadOnlyList<ExcelTeacher> ReadTeachers()
    {
        var ws = GetSheet(ExcelSheets.Teachers);
        var rows = new List<ExcelTeacher>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            rows.Add(new ExcelTeacher(
                ExcelId:      Str(row.Cell(1))!,
                FullName:     Str(row.Cell(2))!,
                DocNumber:    NumericId(row.Cell(3))!,
                Phone:        NumericId(row.Cell(4)),
                Email:        Str(row.Cell(5)),
                Specialty:    Str(row.Cell(6)),
                RegisteredAt: Date(row.Cell(7))));
        }
        return rows;
    }

    public IReadOnlyList<ExcelStudent> ReadStudents()
    {
        var ws = GetSheet(ExcelSheets.Students);
        var rows = new List<ExcelStudent>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            rows.Add(new ExcelStudent(
                ExcelId:      Str(row.Cell(1))!,
                FullName:     Str(row.Cell(2))!,
                DocNumber:    NumericId(row.Cell(3))!,
                Phone:        NumericId(row.Cell(4)),
                Email:        Str(row.Cell(5)),
                RegisteredAt: Date(row.Cell(6)),
                Source:       Str(row.Cell(7)),
                Notes:        Str(row.Cell(8))));
        }
        return rows;
    }

    public IReadOnlyList<ExcelSchedule> ReadSchedules()
    {
        var ws = GetSheet(ExcelSheets.Schedules);
        var rows = new List<ExcelSchedule>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            rows.Add(new ExcelSchedule(
                ExcelId:        Str(row.Cell(1))!,
                Course:         Str(row.Cell(2))!,
                Level:          Str(row.Cell(3))!,
                TeacherExcelId: Str(row.Cell(4))!,
                TeacherName:    Str(row.Cell(5))!,
                DaysLabel:      Str(row.Cell(6))!,
                StartTime:      Time(row.Cell(7)),
                EndTime:        Time(row.Cell(8)),
                Price:          Decimal(row.Cell(9)),
                Capacity:       IntOrDefault(row.Cell(10), 10, $"schedule {row.Cell(1).GetString()} capacity"),
                Status:         Str(row.Cell(11))!,
                StartDate:      DateOnlyValue(row.Cell(12))));
        }
        return rows;
    }

    public IReadOnlyList<ExcelEnrollment> ReadEnrollments()
    {
        var ws = GetSheet(ExcelSheets.Enrollments);
        var rows = new List<ExcelEnrollment>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            rows.Add(new ExcelEnrollment(
                ExcelId:         Str(row.Cell(1))!,
                StudentExcelId:  Str(row.Cell(2))!,
                StudentName:     Str(row.Cell(3))!,
                ScheduleExcelId: Str(row.Cell(4))!,
                ScheduleLabel:   Str(row.Cell(5))!,
                EnrollmentDate:  DateOnlyValue(row.Cell(6)),
                Status:          Str(row.Cell(7))!));
        }
        return rows;
    }

    public IReadOnlyList<ExcelPayment> ReadPayments()
    {
        var ws = GetSheet(ExcelSheets.Payments);
        var rows = new List<ExcelPayment>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            var hasReceipt = (Str(row.Cell(9)) ?? "").Equals("Sí", StringComparison.OrdinalIgnoreCase);
            rows.Add(new ExcelPayment(
                ExcelId:           Str(row.Cell(1))!,
                EnrollmentExcelId: Str(row.Cell(2))!,
                StudentName:       Str(row.Cell(3))!,
                ScheduleLabel:     Str(row.Cell(4))!,
                Date:              DateOnlyValue(row.Cell(5)),
                Amount:            Decimal(row.Cell(6)),
                InstallmentNumber: Int(row.Cell(7)),
                PaymentMethod:     StrOrDefault(row.Cell(8), "Efectivo", $"payment {row.Cell(1).GetString()} method"),
                HasReceipt:        hasReceipt,
                ReceiptNumber:     Str(row.Cell(10)),
                Notes:             Str(row.Cell(11))));
        }
        return rows;
    }

    public IReadOnlyList<ExcelExpense> ReadExpenses()
    {
        var ws = GetSheet(ExcelSheets.Expenses);
        var rows = new List<ExcelExpense>();
        foreach (var row in DataRows(ws, idColumn: 1))
        {
            rows.Add(new ExcelExpense(
                ExcelId:         Str(row.Cell(1))!,
                Date:            DateOnlyValue(row.Cell(2)),
                Category:        Str(row.Cell(3))!,
                Description:     Str(row.Cell(4))!,
                Amount:          Decimal(row.Cell(5)),
                PaymentMethod:   Str(row.Cell(6))!,
                Notes:           Str(row.Cell(7)),
                ScheduleExcelId: Str(row.Cell(8))));
        }
        return rows;
    }

    public void Dispose()
    {
        _wb.Dispose();
        if (_tempCopyPath is not null && File.Exists(_tempCopyPath))
        {
            try { File.Delete(_tempCopyPath); } catch { /* best-effort */ }
        }
    }

    // --- private helpers ------------------------------------------------

    private IXLWorksheet GetSheet(string name) =>
        _wb.Worksheets.TryGetWorksheet(name, out var ws)
            ? ws
            : throw new InvalidDataException($"Sheet '{name}' not found in workbook.");

    private static IEnumerable<IXLRow> DataRows(IXLWorksheet ws, int idColumn)
    {
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (var i = 2; i <= lastRow; i++)
        {
            var row = ws.Row(i);
            // Treat the id column as the row's "is real" anchor — empty id = blank/spacer row.
            if (string.IsNullOrWhiteSpace(row.Cell(idColumn).GetString()))
                continue;
            yield return row;
        }
    }

    private static string? Str(IXLCell cell)
    {
        if (cell.IsEmpty()) return null;
        var v = cell.GetString().Trim();
        return string.IsNullOrEmpty(v) ? null : v;
    }

    /// <summary>
    /// DNI / phone columns are stored as numbers in the sheet, which ClosedXML
    /// reads as <c>"40734073"</c> for ints but <c>"40734073.0"</c> for cells
    /// formatted as decimals. Strip any trailing <c>.0</c>.
    /// </summary>
    private static string? NumericId(IXLCell cell)
    {
        var s = Str(cell);
        if (s is null) return null;
        if (s.EndsWith(".0", StringComparison.Ordinal)) s = s[..^2];
        return s;
    }

    private static DateTime? Date(IXLCell cell)
    {
        if (cell.IsEmpty()) return null;
        if (cell.DataType == XLDataType.DateTime) return cell.GetDateTime();
        var value = cell.GetString().Trim();
        var formats = new[] { "d/M/yyyy", "dd/MM/yyyy", "d/M/yy", "dd/MM/yy", "yyyy-MM-dd" };
        if (DateTime.TryParseExact(value, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
            return exact;
        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("es-PE"), DateTimeStyles.None, out var localized))
            return localized;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return dt;
        return null;
    }

    private static DateOnly DateOnlyValue(IXLCell cell)
    {
        var dt = Date(cell)
            ?? throw new InvalidDataException($"Required date missing at {cell.Address}");
        return DateOnly.FromDateTime(dt);
    }

    private static TimeOnly Time(IXLCell cell)
    {
        if (cell.DataType == XLDataType.TimeSpan)
            return TimeOnly.FromTimeSpan(cell.GetTimeSpan());
        if (cell.DataType == XLDataType.DateTime)
            return TimeOnly.FromDateTime(cell.GetDateTime());
        var s = cell.GetString();
        if (TimeOnly.TryParse(s, out var t)) return t;
        if (TimeSpan.TryParse(s, out var ts)) return TimeOnly.FromTimeSpan(ts);
        throw new InvalidDataException($"Cannot parse time at {cell.Address}: '{s}'");
    }

    private static decimal Decimal(IXLCell cell)
    {
        if (cell.DataType == XLDataType.Number) return (decimal)cell.GetDouble();
        var s = cell.GetString();
        return decimal.Parse(s, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static int Int(IXLCell cell)
    {
        if (cell.DataType == XLDataType.Number) return (int)cell.GetDouble();
        var s = cell.GetString();
        return int.Parse(s, System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Returns <see cref="Int"/> when the cell has a value; otherwise emits a warning
    /// to stderr and returns <paramref name="default"/>. Used for sparse legacy data
    /// where a sensible default is preferable to halting the seed.
    /// </summary>
    private static int IntOrDefault(IXLCell cell, int @default, string contextForWarn)
    {
        if (cell.IsEmpty())
        {
            Console.Error.WriteLine($"[seed] WARN: {contextForWarn} missing, defaulting to {@default}");
            return @default;
        }
        return Int(cell);
    }

    /// <summary>
    /// Returns <see cref="Str"/> when the cell has a non-empty value; otherwise emits
    /// a warning to stderr and returns <paramref name="default"/>.
    /// </summary>
    private static string StrOrDefault(IXLCell cell, string @default, string contextForWarn)
    {
        var v = Str(cell);
        if (string.IsNullOrEmpty(v))
        {
            Console.Error.WriteLine($"[seed] WARN: {contextForWarn} missing, defaulting to '{@default}'");
            return @default;
        }
        return v;
    }
}
