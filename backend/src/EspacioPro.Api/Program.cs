using System.Text.Json;
using System.Text.Json.Serialization;
using EspacioPro.Application.Abstractions;
using EspacioPro.Application.Common;
using EspacioPro.Application.Health;
using EspacioPro.Infrastructure.Auth;
using EspacioPro.Infrastructure.Cosmos;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication(worker =>
    {
        worker.UseMiddleware<EspacioPro.Api.Middleware.CorsMiddleware>();
        worker.UseMiddleware<EspacioPro.Api.Middleware.CorrelationIdMiddleware>();
        worker.UseMiddleware<EspacioPro.Api.Middleware.JwtAuthMiddleware>();
    })
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        // 1. Options binding
        services.Configure<CosmosOptions>(opts =>
        {
            opts.Endpoint = config["COSMOS_ACCOUNT_ENDPOINT"] ?? string.Empty;
            opts.Database = config["COSMOS_DATABASE_NAME"] ?? string.Empty;
            // Optional. When set, takes precedence over Managed Identity / az login.
            // Local-dev convenience only; production must rely on Managed Identity.
            opts.ConnectionString = config["COSMOS_CONNECTION_STRING"];
            opts.ConnectionMode = config["COSMOS_CONNECTION_MODE"];
        });

        services.Configure<ClerkOptions>(opts =>
        {
            opts.JwksUrl = config["CLERK_JWKS_URL"] ?? string.Empty;
            opts.Issuer = config["CLERK_ISSUER"] ?? string.Empty;
        });

        // 2. Cosmos client singleton
        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<IOptions<CosmosOptions>>().Value;
            return CosmosClientFactory.Create(options);
        });

        // 3. Caching, HTTP client, HttpContext
        services.AddMemoryCache();
        services.AddHttpClient();
        services.AddHttpContextAccessor();

        // 4. Auth services
        services.AddSingleton<IClerkJwtValidator, ClerkJwtValidator>();
        services.AddScoped<ICurrentUser, CurrentUserAccessor>();

        // 5. Application services
        services.AddScoped<HealthService>();

        // 6. Domain repositories (scoped — depends on ICurrentUser)
        services.AddScoped<CatalogRepository>();
        services.AddScoped<TeacherRepository>();
        services.AddScoped<StudentRepository>();
        services.AddScoped<ScheduleRepository>();
        services.AddScoped<EnrollmentRepository>();
        services.AddScoped<StudentPaymentRepository>();
        services.AddScoped<TeacherPaymentRepository>();
        services.AddScoped<ExpenseRepository>();

        // 7. JSON serialization defaults — per docs/07-api-contract-cheatsheet.md §2 + §4
        // AddMvc().AddJsonOptions() configures OkObjectResult / IActionResult serialization.
        services.AddMvc().AddJsonOptions(opts =>
        {
            opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            opts.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
            opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
            opts.JsonSerializerOptions.Converters.Add(new TimeOnlyHHmmJsonConverter());
        });

        // ReadFromJsonAsync uses Microsoft.AspNetCore.Http.Json.JsonOptions, not MVC options.
        // Keep request bodies aligned with response and Cosmos serialization.
        services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(opts =>
        {
            opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            opts.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
            opts.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            opts.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
            opts.SerializerOptions.Converters.Add(new TimeOnlyHHmmJsonConverter());
        });
    })
    .Build();

host.Run();
