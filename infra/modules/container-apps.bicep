// Container Apps Environment + two Container Apps for the Procurement Agent PoC.
// - ca-mcp-server:  external ingress (port 8081) — public HTTPS, protected by X-API-Key
// - ca-ai-service:  external ingress (port 8080) — public HTTPS endpoint

// ── Parameters ───────────────────────────────────────────────────────

@description('Azure region for all Container Apps resources')
param location string

@description('Unique suffix shared with other PoC resources')
param suffix string

@description('ACR login server, e.g. azacrshared.azurecr.io')
param acrLoginServer string

@description('ACR resource name, e.g. azacrshared')
param acrName string

@description('Resource group that owns the ACR (for reference only — not used at deploy time)')
#disable-next-line no-unused-params
param acrResourceGroupName string

@secure()
@description('ACR admin password — pass at deploy time, never commit')
param acrAdminPassword string

@description('Azure OpenAI / AI Services endpoint URL')
param aiServicesEndpoint string

@description('Chat model deployment name, e.g. gpt-4.1')
param chatDeploymentName string

@description('Azure AI Search endpoint URL')
param searchEndpoint string

@description('Cosmos DB endpoint URL')
param cosmosEndpoint string

@secure()
@description('Azure AI Services / OpenAI API key — pass at deploy time')
param aiServicesKey string = ''

@secure()
@description('Azure AI Search admin key — pass at deploy time')
param searchKey string = ''

@secure()
@description('Cosmos DB primary key — pass at deploy time')
param cosmosKey string = ''

@description('Tags applied to all resources created by this module')
param tags object = {}

@description('Entra App Registration client ID for the Teams/M365 bot (optional — leave empty to disable)')
param botAppId string = ''

@secure()
@description('Entra App Registration client secret for the Teams/M365 bot (optional — leave empty to disable)')
param botAppPassword string = ''

@description('Entra App Registration tenant ID for the Teams/M365 bot (optional)')
param botAppTenantId string = ''

@secure()
@description('Application Insights connection string — enables traces/metrics/logs in AI Foundry (optional)')
param appInsightsConnectionString string = ''

@secure()
@description('API key required for X-API-Key header on MCP server requests (optional — leave empty to disable auth)')
param mcpApiKey string = ''

// ── Container Apps Environment ────────────────────────────────────────

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-procurement-${suffix}'
  location: location
  // BCP187: 'identity' is valid for managedEnvironments but missing from the Bicep type definition.
  // The system-assigned identity is required so Container Apps can use 'identity: system' in secretRef.
  #disable-next-line BCP187
  identity: {
    // System-assigned identity is used to pull secrets from Key Vault via secretRef
    type: 'SystemAssigned'
  }
  properties: {
    // Serverless workload profiles — cheapest option for a PoC
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
  tags: tags
}

// ── MCP Server — internal Container App ──────────────────────────────
//
// Exposes the SAP mock MCP server on port 8081.
// ingress.external = false  →  only reachable from within the same environment.

resource mcpServerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-mcp-server-${suffix}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    workloadProfileName: 'Consumption'

    configuration: {
      // ── ACR pull credentials ────────────────────────────────────────
      registries: [
        {
          server: acrLoginServer
          username: acrName
          passwordSecretRef: 'acr-admin-password'
        }
      ]

      // ── Secrets (Key Vault refs + ACR password) ────────────────────
      secrets: [
        {
          // ACR admin password for image pull (not from KV — passed as param)
          name: 'acr-admin-password'
          value: acrAdminPassword
        }
        ...(!empty(cosmosKey) ? [{
          name: 'cosmos-key'
          value: cosmosKey
        }] : [])
        ...(!empty(mcpApiKey) ? [{
          name: 'mcp-api-key'
          value: mcpApiKey
        }] : [])
      ]

      // ── Ingress — external (Copilot Studio reaches it from internet) ──
      // Protected by X-API-Key header via API_KEY env var.
      ingress: {
        external: true
        targetPort: 8081
        transport: 'http'
        allowInsecure: false
      }
    }

    template: {
      containers: [
        {
          name: 'mcp-server'
          image: '${acrLoginServer}/procurement-mcp-server:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'COSMOS_ENDPOINT'
              value: cosmosEndpoint
            }
            {
              name: 'COSMOS_DATABASE'
              value: 'procurement'
            }
            ...(!empty(cosmosKey) ? [{
              name: 'COSMOS_KEY'
              secretRef: 'cosmos-key'
            }] : [])
            {
              name: 'MCP_SERVER_PORT'
              value: '8081'
            }
            ...(!empty(mcpApiKey) ? [
              {
                name: 'API_KEY'
                secretRef: 'mcp-api-key'
              }
            ] : [])
          ]
        }
      ]

      // ── Scale — PoC: always 1 replica to avoid cold start delays ──
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
  tags: tags
}

// ── AI Service — external Container App ──────────────────────────────
//
// Exposes the MAF DevUI / agent service on port 8080 via public HTTPS.
// ingress.external = true  →  Azure Front Door / public ingress assigned automatically.

resource aiServiceApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-ai-service-${suffix}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    workloadProfileName: 'Consumption'

    configuration: {
      // ── ACR pull credentials ────────────────────────────────────────
      registries: [
        {
          server: acrLoginServer
          username: acrName
          passwordSecretRef: 'acr-admin-password'
        }
      ]

      // ── Secrets (Key Vault refs + ACR password) ────────────────────
      secrets: [
        {
          name: 'acr-admin-password'
          value: acrAdminPassword
        }
        ...(!empty(aiServicesKey) ? [{
          name: 'azure-openai-key'
          value: aiServicesKey
        }] : [])
        ...(!empty(searchKey) ? [{
          name: 'azure-search-key'
          value: searchKey
        }] : [])
        ...(!empty(cosmosKey) ? [{
          name: 'cosmos-key'
          value: cosmosKey
        }] : [])
        // Bot credentials — only included when botAppPassword is provided
        ...(!empty(botAppPassword) ? [{
          name: 'bot-app-password'
          value: botAppPassword
        }] : [])
        // App Insights — only included when connection string is provided
        ...(!empty(appInsightsConnectionString) ? [{
          name: 'app-insights-connection-string'
          value: appInsightsConnectionString
        }] : [])
      ]

      // ── Ingress — public HTTPS ─────────────────────────────────────
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
    }

    template: {
      containers: [
        {
          name: 'ai-service'
          image: '${acrLoginServer}/procurement-ai-service:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: aiServicesEndpoint
            }
            {
              name: 'AZURE_OPENAI_CHAT_DEPLOYMENT_NAME'
              value: chatDeploymentName
            }
            ...(!empty(aiServicesKey) ? [{
              name: 'AZURE_OPENAI_API_KEY'
              secretRef: 'azure-openai-key'
            }] : [])
            {
              name: 'AZURE_SEARCH_ENDPOINT'
              value: searchEndpoint
            }
            ...(!empty(searchKey) ? [{
              name: 'AZURE_SEARCH_API_KEY'
              secretRef: 'azure-search-key'
            }] : [])
            {
              name: 'COSMOS_ENDPOINT'
              value: cosmosEndpoint
            }
            {
              name: 'COSMOS_DATABASE'
              value: 'procurement'
            }
            ...(!empty(cosmosKey) ? [{
              name: 'COSMOS_KEY'
              secretRef: 'cosmos-key'
            }] : [])
            {
              // ai-service uses internal DNS to reach mcp-server within the same environment.
              // Short hostname still works even though mcp-server now has external ingress.
              name: 'MCP_SERVER_URL'
              value: 'http://ca-mcp-server-${suffix}:8081/mcp'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            // Bot credentials — only injected when botAppId is provided
            ...(!empty(botAppId) ? [
              {
                name: 'MICROSOFT_APP_ID'
                value: botAppId
              }
              {
                name: 'MICROSOFT_APP_PASSWORD'
                secretRef: 'bot-app-password'
              }
              {
                name: 'MICROSOFT_APP_TENANT_ID'
                value: botAppTenantId
              }
            ] : [])
            // App Insights telemetry — only injected when connection string is provided
            ...(!empty(appInsightsConnectionString) ? [
              {
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                secretRef: 'app-insights-connection-string'
              }
            ] : [])
          ]
        }
      ]

      // ── Scale — keep 1 warm replica to avoid cold-start latency ────
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
  tags: tags
}

// ── Outputs ──────────────────────────────────────────────────────────

@description('Public FQDN for the AI Service (external ingress)')
output aiServiceFqdn string = aiServiceApp.properties.configuration.ingress.fqdn

@description('Internal hostname for the MCP Server (reachable only within the environment)')
output mcpServerInternalFqdn string = mcpServerApp.properties.configuration.ingress.fqdn

@description('Container Apps Environment resource ID — used by other modules that need to join the same environment')
output containerAppsEnvironmentId string = containerAppsEnvironment.id

@description('Internal URL for the AI Service — used by the frontend proxy (MAF_BASE_URL)')
output aiServiceInternalUrl string = 'http://ca-ai-service-${suffix}'

@description('Internal URL for the MCP Server — used by the frontend proxy (MCP_SERVER_URL)')
output mcpServerInternalUrl string = 'http://ca-mcp-server-${suffix}'
