using System.Text.Json;
using EspacioPro.Application.Abstractions;
using EspacioPro.Infrastructure.Cosmos;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed;
using EspacioPro.Seed.Excel;
using EspacioPro.Seed.Migrations;
using EspacioPro.Seed.Seeders;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

// -------- Argument parsing --------
// Supports: --excel <path>  --reset  --yes
//           --migrate-enums  --apply
//           --COSMOS_ACCOUNT_ENDPOINT=<url>  --COSMOS_DATABASE_NAME=<db>
var argList = args.ToList();
var reset = argList.Remove("--reset");
var yes = argList.Remove("--yes") | argList.Remove("-y");
var migrateEnums = argList.Remove("--migrate-enums");
var apply = argList.Remove("--apply");

string? excelPath = null;
for (var i = 0; i < argList.Count; i++)
{
    if (argList[i] == "--excel" && i + 1 < argList.Count)
    {
        excelPath = argList[i + 1];
        argList.RemoveAt(i + 1);
        argList.RemoveAt(i);
        break;
    }
}

// -------- Configuration sources --------
// Precedence (last source wins): local.settings.json (Functions host file)
// → environment variables → command line. So the seeder picks up the API's
// dev settings automatically, but env/CLI can still override anything.
var (localSettings, localSettingsPath) = LoadApiLocalSettings();

var config = new ConfigurationBuilder()
    .AddInMemoryCollection(localSettings)
    .AddEnvironmentVariables()
    .AddCommandLine(argList.ToArray())
    .Build();

var endpoint = config["COSMOS_ACCOUNT_ENDPOINT"];
var database = config["COSMOS_DATABASE_NAME"];
var connectionString = config["COSMOS_CONNECTION_STRING"];

excelPath ??= config["EXCEL_PATH"]
    ?? Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "tmp", "ESPACIO_PRO_SYSTEM.xlsx");

var hasConnectionString = !string.IsNullOrWhiteSpace(connectionString);
var hasEndpoint = !string.IsNullOrWhiteSpace(endpoint);

if (!hasConnectionString && !hasEndpoint)
{
    Console.Error.WriteLine("ERROR: missing Cosmos auth — set COSMOS_ACCOUNT_ENDPOINT (Mode A, az login) or COSMOS_CONNECTION_STRING (Mode B).");
    Console.Error.WriteLine($"  local.settings.json checked: {localSettingsPath ?? "(not found)"}");
    Console.Error.WriteLine("  Pass --COSMOS_ACCOUNT_ENDPOINT=<url> --COSMOS_DATABASE_NAME=<db> or set env vars.");
    return 2;
}
if (string.IsNullOrWhiteSpace(database))
{
    Console.Error.WriteLine("ERROR: COSMOS_DATABASE_NAME is required.");
    Console.Error.WriteLine($"  local.settings.json checked: {localSettingsPath ?? "(not found)"}");
    return 2;
}

excelPath = Path.GetFullPath(excelPath);
if (!migrateEnums && !File.Exists(excelPath))
{
    Console.Error.WriteLine($"ERROR: Excel file not found: {excelPath}");
    Console.Error.WriteLine("Pass --excel <path> or set EXCEL_PATH.");
    return 2;
}

// -------- DI wiring --------
var services = new ServiceCollection();

services.AddLogging(b => b.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "HH:mm:ss ";
}));

services.Configure<CosmosOptions>(opts =>
{
    opts.Endpoint = endpoint ?? string.Empty;
    opts.Database = database!;
    opts.ConnectionString = connectionString;
});

services.AddSingleton(sp =>
{
    var options = sp.GetRequiredService<IOptions<CosmosOptions>>().Value;
    return CosmosClientFactory.Create(options);
});

services.AddSingleton<ICurrentUser, SystemCurrentUser>();
services.AddSingleton(_ => new ExcelReader(excelPath));
services.AddSingleton<SeedContext>();
services.AddSingleton<SeedResetter>();
services.AddSingleton<EnumWireFormatMigrator>();

// Repositories (one per entity).
services.AddScoped<CatalogRepository>();
services.AddScoped<TeacherRepository>();
services.AddScoped<StudentRepository>();
services.AddScoped<ScheduleRepository>();
services.AddScoped<EnrollmentRepository>();
services.AddScoped<StudentPaymentRepository>();
services.AddScoped<ExpenseRepository>();

// Seeders (one per entity).
services.AddScoped<CatalogSeeder>();
services.AddScoped<TeacherSeeder>();
services.AddScoped<StudentSeeder>();
services.AddScoped<ScheduleSeeder>();
services.AddScoped<EnrollmentSeeder>();
services.AddScoped<StudentPaymentSeeder>();
services.AddScoped<ExpenseSeeder>();

await using var provider = services.BuildServiceProvider();
var logger = provider.GetRequiredService<ILogger<Program>>();

logger.LogInformation("Espacio Pro seeder");
logger.LogInformation("  config   : {Source}", localSettingsPath ?? "(env/CLI only)");
logger.LogInformation("  auth     : {Mode}", hasConnectionString ? "connection string" : "DefaultAzureCredential (az login)");
logger.LogInformation("  endpoint : {Endpoint}", hasEndpoint ? endpoint : "(via connection string)");
logger.LogInformation("  database : {Db}", database);
if (!migrateEnums)
    logger.LogInformation("  excel    : {Path}", excelPath);
logger.LogInformation("  reset    : {Reset}", reset);
logger.LogInformation("  mode     : {Mode}", migrateEnums ? "enum migration" : "seed");

try
{
    if (migrateEnums)
    {
        var migrator = provider.GetRequiredService<EnumWireFormatMigrator>();
        var result = await migrator.RunAsync(apply);
        logger.LogInformation("Enum migration complete. Mode={Mode} Scanned={Scanned} Updated={Updated}",
            apply ? "apply" : "dry-run",
            result.Scanned,
            result.Updated);
        if (!apply && result.Updated > 0)
            logger.LogWarning("Dry-run only. Re-run with --migrate-enums --apply to persist these changes.");
        return 0;
    }

    var resetter = provider.GetRequiredService<SeedResetter>();
    var existing = await resetter.CountAsync();

    if (existing > 0 && !reset)
    {
        logger.LogError("Found {Count} document(s) previously created by the seeder. Re-run with --reset to soft-delete them and re-seed.", existing);
        return 1;
    }

    if (reset)
    {
        if (!yes)
        {
            Console.Write($"About to soft-delete {existing} previously seeded document(s) and re-seed from {Path.GetFileName(excelPath)}. Continue? [y/N] ");
            var line = Console.ReadLine();
            if (!string.Equals((line ?? "").Trim(), "y", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Aborted by user.");
                return 0;
            }
        }
        if (existing > 0)
            await resetter.RunAsync();
    }

    using var scope = provider.CreateScope();
    var sp = scope.ServiceProvider;

    logger.LogInformation("Seeding catalogs...");
    var catalogs = await sp.GetRequiredService<CatalogSeeder>().RunAsync();

    logger.LogInformation("Seeding teachers...");
    var teachers = await sp.GetRequiredService<TeacherSeeder>().RunAsync();

    logger.LogInformation("Seeding students...");
    var students = await sp.GetRequiredService<StudentSeeder>().RunAsync();

    logger.LogInformation("Seeding schedules...");
    var schedules = await sp.GetRequiredService<ScheduleSeeder>().RunAsync();

    logger.LogInformation("Seeding enrollments...");
    var enrollments = await sp.GetRequiredService<EnrollmentSeeder>().RunAsync();

    logger.LogInformation("Seeding student payments...");
    var payments = await sp.GetRequiredService<StudentPaymentSeeder>().RunAsync();

    logger.LogInformation("Seeding expenses...");
    var expenses = await sp.GetRequiredService<ExpenseSeeder>().RunAsync();

    logger.LogInformation("Done. Inserted: catalogs={C} teachers={T} students={S} schedules={Sc} enrollments={E} payments={P} expenses={X}",
        catalogs, teachers, students, schedules, enrollments, payments, expenses);

    return 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Seeder failed.");
    return 1;
}

// -------- helpers --------

// Loads the API's Functions-host local.settings.json (the "Values" map) so the
// seeder can reuse the same dev config (COSMOS_*, etc.) without forcing the
// developer to re-export env vars. Returns the flattened key/value pairs and
// the absolute path of the source file (or null if not found).
static (Dictionary<string, string?> Values, string? Path) LoadApiLocalSettings()
{
    foreach (var candidate in CandidatePaths())
    {
        if (!File.Exists(candidate)) continue;
        try
        {
            using var stream = File.OpenRead(candidate);
            using var doc = JsonDocument.Parse(stream, new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });
            if (!doc.RootElement.TryGetProperty("Values", out var values) || values.ValueKind != JsonValueKind.Object)
                continue;

            var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in values.EnumerateObject())
            {
                // Skip self-documenting comment keys ("// foo": "...") used in local.settings.json.
                if (prop.Name.StartsWith("//", StringComparison.Ordinal)) continue;
                if (prop.Value.ValueKind != JsonValueKind.String) continue;
                dict[prop.Name] = prop.Value.GetString();
            }
            return (dict, System.IO.Path.GetFullPath(candidate));
        }
        catch (JsonException)
        {
            // Malformed file — silently skip; user will see the auth error below if no fallback exists.
        }
    }
    return (new Dictionary<string, string?>(), null);
}

static IEnumerable<string> CandidatePaths()
{
    // 1) Working dir relative — typical when running `dotnet run` from backend/
    yield return Path.Combine(Directory.GetCurrentDirectory(), "src", "EspacioPro.Api", "local.settings.json");
    // 2) Working dir is repo root — also a common case
    yield return Path.Combine(Directory.GetCurrentDirectory(), "backend", "src", "EspacioPro.Api", "local.settings.json");
    // 3) Working dir is the seed project itself
    yield return Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "src", "EspacioPro.Api", "local.settings.json");
    // 4) Exe-relative — fallback when launched from anywhere
    yield return Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "EspacioPro.Api", "local.settings.json");
}

public partial class Program { }
