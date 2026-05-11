using EspacioPro.Application.Abstractions;
using EspacioPro.Infrastructure.Cosmos;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using EspacioPro.Seed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

// Configuration: env vars + CLI args (e.g. --COSMOS_ACCOUNT_ENDPOINT=https://...).
var config = new ConfigurationBuilder()
    .AddEnvironmentVariables()
    .AddCommandLine(args)
    .Build();

var endpoint = config["COSMOS_ACCOUNT_ENDPOINT"];
var database = config["COSMOS_DATABASE_NAME"];

if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(database))
{
    Console.Error.WriteLine("ERROR: COSMOS_ACCOUNT_ENDPOINT and COSMOS_DATABASE_NAME are required.");
    Console.Error.WriteLine("Set them as env vars or pass --COSMOS_ACCOUNT_ENDPOINT=... --COSMOS_DATABASE_NAME=...");
    return 2;
}

var services = new ServiceCollection();

services.AddLogging(b => b.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "HH:mm:ss ";
}));

services.Configure<CosmosOptions>(opts =>
{
    opts.Endpoint = endpoint;
    opts.Database = database;
});

services.AddSingleton(sp =>
{
    var options = sp.GetRequiredService<IOptions<CosmosOptions>>().Value;
    return CosmosClientFactory.Create(options);
});

services.AddSingleton<ICurrentUser, SystemCurrentUser>();
services.AddScoped<CatalogRepository>();
services.AddScoped<CatalogSeeder>();

var provider = services.BuildServiceProvider();
var logger = provider.GetRequiredService<ILogger<Program>>();

logger.LogInformation("Seeding catalogs in database '{Db}' at {Endpoint}", database, endpoint);

try
{
    using var scope = provider.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
    var created = await seeder.RunAsync();
    logger.LogInformation("Done. {Count} catalog(s) created.", created);
    return 0;
}
catch (Exception ex)
{
    logger.LogError(ex, "Seeder failed.");
    return 1;
}

public partial class Program { }
