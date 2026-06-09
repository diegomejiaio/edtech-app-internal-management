using EspacioPro.TelegramAgent.Agent;
using EspacioPro.TelegramAgent.Agent.Foundry;
using EspacioPro.TelegramAgent.Api;
using EspacioPro.TelegramAgent.Security;
using EspacioPro.TelegramAgent.Telegram;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices((context, services) =>
    {
        services.AddHttpClient();

        services.AddSingleton<AccessPolicy>();
        services.AddSingleton<TelegramClient>();
        services.AddSingleton<EspacioProApiClient>();

        // Router selection: AGENT_ROUTER=foundry delegates turns to the Foundry
        // Persistent Agent; any other value keeps the deterministic v0 router.
        var router = context.Configuration["AGENT_ROUTER"];
        if (string.Equals(router, "foundry", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<FoundryAgentProvisioner>();
            services.AddSingleton<AgentToolDispatcher>();
            services.AddSingleton<EspacioPro.TelegramAgent.Speech.SpeechTranscriber>();
            services.AddSingleton<IAgentRouter, FoundryAgentRouter>();
        }
        else
        {
            services.AddSingleton<IAgentRouter, DeterministicAgentRouter>();
        }
    })
    .Build();

host.Run();
