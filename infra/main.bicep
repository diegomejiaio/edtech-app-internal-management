// ── Procurement Agent PoC — Infrastructure ─────────────────────────
// Creates PoC-specific resources and references shared services.
//
// First-time deploy (creates all resources including frontend CA):
//
//   ACR_PASS=$(az acr credential show \
//     --name azacrshared \
//     --resource-group rg-shared-services \
//     --query "passwords[0].value" -o tsv)
//
//   AI_KEY=$(az cognitiveservices account keys list \
//     --name aifoundrysharedservices00001 \
//     --resource-group rg-shared-services \
//     --query key1 -o tsv)
//
//   SEARCH_KEY=$(az search admin-key show \
//     --service-name search-procurement-poc01 \
//     --resource-group rg-procurement-agent-poc \
//     --query primaryKey -o tsv)
//
//   COSMOS_KEY=$(az cosmosdb keys list \
//     --name shared-cosmos-nosql \
//     --resource-group rg-shared-services \
//     --type keys \
//     --query primaryMasterKey -o tsv)
//
//   az deployment group create \
//     --resource-group rg-procurement-agent-poc \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam \
//       acrAdminPassword="$ACR_PASS" \
//       aiServicesKey="$AI_KEY" \
//       searchKey="$SEARCH_KEY" \
//       cosmosKey="$COSMOS_KEY" \
//       appInsightsConnectionString="$APP_INSIGHTS_CONN" \
//       frontendImage="azacrshared.azurecr.io/procurement-frontend:latest"
//
// For iterative frontend-only updates (after first deploy):
//   ./infra/deploy-frontend.sh
// ────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

// ── Parameters ─────────────────────────────────────────────────────

@description('Location for PoC resources')
param location string = resourceGroup().location

@description('Unique suffix for resource names (keep short)')
param suffix string = 'poc01'

@description('Shared services resource group name')
param sharedRgName string = 'rg-shared-services'

@description('Shared AI Foundry (Cognitive Services) account name')
param sharedAiServicesName string = 'aifoundrysharedservices00001'

@description('Shared Key Vault name')
param sharedKeyVaultName string = 'kv-shared-services-00001'

@description('Shared Storage Account name')
param sharedStorageAccountName string = 'sasharedservices00001'

@description('Shared Cosmos DB account name')
param sharedCosmosAccountName string = 'shared-cosmos-nosql'

@description('Name of the existing chat model deployment in AI Foundry')
param chatDeploymentName string = 'gpt-4.1'

@description('ACR name in shared resource group')
param acrName string = 'azacrshared'

@secure()
@description('ACR admin password for image pull — pass at deploy time, never commit')
param acrAdminPassword string = ''

@secure()
@description('Entra App Registration client ID for the Teams bot (pre-created manually — see DEPLOYMENT.md)')
param botAppId string = ''

@secure()
@description('Entra App Registration client secret for the Teams bot')
param botAppPassword string = ''

@secure()
@description('Entra App Registration tenant ID for the Teams bot')
param botAppTenantId string = ''

@secure()
@description('Azure AI Services API key — pass at deploy time')
param aiServicesKey string = ''

@secure()
@description('Azure AI Search admin key — pass at deploy time')
param searchKey string = ''

@secure()
@description('Cosmos DB primary key — pass at deploy time')
param cosmosKey string = ''

@secure()
@description('Application Insights connection string for telemetry — pass at deploy time')
param appInsightsConnectionString string = ''

@secure()
@description('API key for MCP server X-API-Key auth — pass at deploy time, leave empty to disable auth')
param mcpApiKey string = ''

@secure()
@description('Optional MAF auth token forwarded from the frontend proxy to the AI Service — leave empty to disable')
param mafAuthToken string = ''

@description('Frontend container image — defaults to placeholder; pass the real image tag at deploy time')
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Entra App Registration client ID for frontend Easy Auth — leave empty to deploy without auth')
param frontendEntraClientId string = ''

@secure()
@description('Entra App Registration client secret for frontend Easy Auth — leave empty to deploy without auth')
param frontendEntraClientSecret string = ''

@description('Entra tenant ID — required when frontendEntraClientId is provided')
param frontendEntraTenantId string = ''

// ── References to shared services (existing) ──────────────────────

resource sharedAiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: sharedAiServicesName
  scope: resourceGroup(sharedRgName)
}

resource sharedKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: sharedKeyVaultName
  scope: resourceGroup(sharedRgName)
}

// Reference to the existing shared Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: acrName
  scope: resourceGroup(sharedRgName)
}

// Reference to the existing shared Cosmos DB account
resource sharedCosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: sharedCosmosAccountName
  scope: resourceGroup(sharedRgName)
}

// ── AI Search (Free tier — PoC only) ──────────────────────────────

resource aiSearch 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: 'search-procurement-${suffix}'
  location: location
  sku: {
    name: 'free'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
  }
  tags: {
    project: 'procurement-agent-poc'
    environment: 'poc'
  }
}

// ── Storage container for contract PDFs (in shared storage) ───────

module blobContainer 'modules/blob-container.bicep' = {
  name: 'deploy-blob-container'
  scope: resourceGroup(sharedRgName)
  params: {
    storageAccountName: sharedStorageAccountName
    containerName: 'procurement-contracts'
  }
}

// ── Key Vault secrets (AI services key + Search key + Cosmos key) ─

module secrets 'modules/keyvault-secrets.bicep' = {
  name: 'deploy-kv-secrets'
  scope: resourceGroup(sharedRgName)
  params: {
    keyVaultName: sharedKeyVaultName
    aiServicesName: sharedAiServicesName
    searchServiceName: aiSearch.name
    searchServiceRgName: resourceGroup().name
    cosmosAccountName: sharedCosmosAccountName
    cosmosAccountRgName: sharedRgName
  }
}

// ── Container Apps (MCP Server + AI Service) ─────────────────────

module containerApps 'modules/container-apps.bicep' = {
  name: 'deploy-container-apps'
  params: {
    location: location
    suffix: suffix
    acrLoginServer: acr.properties.loginServer
    acrName: acrName
    acrResourceGroupName: sharedRgName
    acrAdminPassword: acrAdminPassword
    aiServicesEndpoint: sharedAiServices.properties.endpoint
    chatDeploymentName: chatDeploymentName
    searchEndpoint: 'https://${aiSearch.name}.search.windows.net'
    cosmosEndpoint: sharedCosmos.properties.documentEndpoint
    aiServicesKey: aiServicesKey
    searchKey: searchKey
    cosmosKey: cosmosKey
    botAppId: botAppId
    botAppPassword: botAppPassword
    botAppTenantId: botAppTenantId
    appInsightsConnectionString: appInsightsConnectionString
    mcpApiKey: mcpApiKey
    tags: {
      project: 'procurement-agent-poc'
      environment: 'poc'
    }
  }
}

// ── Azure Bot Service + Teams/M365 Channels ───────────────────────
//
// Only deployed when botAppId is provided (Teams/M365 integration is optional).
// Pre-requisite: create the Entra App Registration manually — see DEPLOYMENT.md.

module botService 'modules/bot-service.bicep' = if (!empty(botAppId)) {
  name: 'deploy-bot-service'
  params: {
    location: location
    suffix: suffix
    aiServiceEndpoint: 'https://${containerApps.outputs.aiServiceFqdn}'
    msaAppId: botAppId
    msaAppTenantId: botAppTenantId
    tags: {
      project: 'procurement-agent-poc'
      environment: 'poc'
    }
  }
}

// ── Frontend Container App (Next.js) ─────────────────────────────
//
// Deploys the Next.js frontend as a Container App in the same environment.
// API Routes in the frontend proxy SSE requests to the AI Service internally.

module frontend 'modules/frontend-app.bicep' = {
  name: 'deploy-frontend'
  params: {
    location: location
    suffix: suffix
    containerAppsEnvironmentId: containerApps.outputs.containerAppsEnvironmentId
    acrLoginServer: acr.properties.loginServer
    acrName: acrName
    acrAdminPassword: acrAdminPassword
    aiServiceInternalUrl: containerApps.outputs.aiServiceInternalUrl
    mcpServerInternalUrl: containerApps.outputs.mcpServerInternalUrl
    mafAuthToken: mafAuthToken
    mcpApiKey: mcpApiKey
    frontendImage: frontendImage
    entraClientId: frontendEntraClientId
    entraClientSecret: frontendEntraClientSecret
    entraTenantId: frontendEntraTenantId
    tags: {
      project: 'procurement-agent-poc'
      environment: 'poc'
    }
  }
}

// ── Outputs ────────────────────────────────────────────────────────

output aiServicesEndpoint string = sharedAiServices.properties.endpoint
output aiServicesName string = sharedAiServices.name
output chatDeploymentName string = chatDeploymentName
output searchServiceName string = aiSearch.name
output searchServiceEndpoint string = 'https://${aiSearch.name}.search.windows.net'
output keyVaultName string = sharedKeyVault.name
output storageAccountName string = sharedStorageAccountName
output blobContainerName string = 'procurement-contracts'
output cosmosDbEndpoint string = sharedCosmos.properties.documentEndpoint
output cosmosDbAccountName string = sharedCosmos.name
output cosmosDbDatabaseName string = 'procurement'
output aiServiceUrl string = containerApps.outputs.aiServiceFqdn
output botMessagesEndpoint string = !empty(botAppId) ? botService.outputs.botEndpoint : ''
output frontendUrl string = frontend.outputs.frontendUrl
