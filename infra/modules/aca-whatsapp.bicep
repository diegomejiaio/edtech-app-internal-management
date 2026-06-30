// -----------------------------------------------------------------------------
// Azure Container Apps for WhatsApp CRM critical services (post-MVP skeleton).
// docs/10-whatsapp-crm-mvp.md §5. NOT wired into main.bicep yet — kept as a
// reference so latency-critical paths (webhook ACK + AI orchestrator) run with
// minReplicas=1 (no cold start) instead of Functions Consumption. Inspired by
// ArnasDon/wacrm (event-driven: webhook -> queue -> worker -> integrations).
// -----------------------------------------------------------------------------

@description('Location for the Container Apps environment.')
param location string = resourceGroup().location

@description('Prefix for resource names.')
param namePrefix string = 'espaciopro'

@description('Container image for wa-webhook (ACK + HMAC + enqueue). Always-on.')
param webhookImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Container image for the AI orchestrator (MAF). Always-on.')
param orchestratorImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-aca-wa-env'
  location: location
  properties: {}
}

resource webhook 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-wa-webhook'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 80 }
    }
    template: {
      containers: [{ name: 'wa-webhook', image: webhookImage }]
      scale: { minReplicas: 1, maxReplicas: 5 } // min=1 avoids Meta retry/dup on cold start
    }
  }
}

resource orchestrator 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-wa-orchestrator'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: false, targetPort: 80 }
    }
    template: {
      containers: [{ name: 'ai-orchestrator', image: orchestratorImage }]
      scale: { minReplicas: 1, maxReplicas: 3 } // always-warm for first-response UX
    }
  }
}

output webhookFqdn string = webhook.properties.configuration.ingress.fqdn
