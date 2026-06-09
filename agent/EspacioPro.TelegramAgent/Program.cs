using EspacioPro.TelegramAgent.Agent;
using EspacioPro.TelegramAgent.Api;
using EspacioPro.TelegramAgent.Security;
using EspacioPro.TelegramAgent.Telegram;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices(services =>
    {
        services.AddHttpClient();

        services.AddSingleton<AccessPolicy>();
        services.AddSingleton<TelegramClient>();
        services.AddSingleton<EspacioProApiClient>();

        // v0 router. Swap for a FoundryAgentRouter (same IAgentRouter contract)
        // once the hosted agent is wired — no changes to the webhook function.
        services.AddSingleton<IAgentRouter, DeterministicAgentRouter>();
    })
    .Build();

host.Run();
