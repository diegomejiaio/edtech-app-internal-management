// =============================================================================
// modules/agent-function-app.bicep
// Telegram agent Function App (Flex Consumption, FC1, Linux, .NET 10 isolated).
//
// This is the EspacioPro.TelegramAgent webhook host. It is intentionally a
// separate Function App from the backend API so the agent can scale and deploy
// independently and never shares the backend's identity or secrets surface.
//
// SECRETS: all three agent secrets (bot token, webhook secret, service key) are
// referenced from Key Vault via @Microsoft.KeyVault(SecretUri=...) app settings.
// The secret VALUES are created out-of-band (CLI) — this module only wires the
// references. The agent MI must hold "Key Vault Secrets User" on the vault and
// "Storage Blob Data Owner" on the shared storage account; those cross-RG role
// assignments live in modules/agent-shared-access.bicep.
//
// STORAGE: reuses the pre-existing shared storage account (cross-RG) with
// identity-based auth (no connection strings). The deployment package container
// is created by agent-shared-access.bicep.
// =============================================================================

targetScope = 'resourceGroup'

@description('Workload short name.')
@minLength(3)
@maxLength(20)
param workload string

@description('Azure region short code.')
@minLength(3)
@maxLength(6)
param regionCode string

@description('Azure region (full name) for resource location.')
param location string

@description('Tags applied to all resources.')
param tags object

@description('Resource ID of the Log Analytics workspace (diagnostic settings).')
param workspaceResourceId string

@description('App Insights connection string. Wired as APPLICATIONINSIGHTS_CONNECTION_STRING.')
@secure()
param appInsightsConnectionString string

@description('Name of the pre-existing shared Storage Account used for the deployment package.')
param storageAccountName string

@description('Resource group of the shared Storage Account (cross-RG).')
param storageResourceGroupName string

@description('Name of the deployment package container (created by agent-shared-access.bicep).')
param deploymentContainerName string

@description('Key Vault SecretUri for the Telegram bot token (no version = latest).')
param botTokenSecretUri string

@description('Key Vault SecretUri for the Telegram webhook secret (no version = latest).')
param webhookSecretUri string

@description('Key Vault SecretUri for the agent service key (no version = latest).')
param agentApiKeySecretUri string

@description('Telegram allowed group chat id (comma-separated). Not a secret.')
param telegramAllowedChatId string

@description('Telegram allowed user ids (comma-separated). Not a secret.')
param telegramAllowedUserIds string

@description('Base URL of the Espacio Pro backend API the agent calls.')
param espacioProApiUrl string

@description('Agent router implementation selector.')
param agentRouter string = 'deterministic'

@description('Foundry project endpoint (PROJECT_ENDPOINT). Used by the foundry router.')
param projectEndpoint string = ''

@description('Foundry model deployment name (AGENT_MODEL). Vision-capable.')
param agentModel string = 'gpt-4.1'

@description('Cognitive Services endpoint for Speech fast-transcription (COGNITIVE_ENDPOINT).')
param cognitiveEndpoint string = ''

@description('Maximum instance count for Flex Consumption.')
@minValue(40)
@maxValue(1000)
param maximumInstanceCount int = 40

@description('Instance memory in MB for Flex Consumption. Allowed: 512, 2048, 4096.')
@allowed([512, 2048, 4096])
param instanceMemoryMB int = 512

@description('Name of the App Service Plan to host the agent. Defaults to a clean name; override to adopt a pre-existing plan (Flex apps cannot be moved between plans).')
param planName string = 'asp-${workload}-agent-${regionCode}'

// -----------------------------------------------------------------------------
// Naming
// -----------------------------------------------------------------------------

var functionAppName = 'func-${workload}-agent-${regionCode}'

// -----------------------------------------------------------------------------
// Shared storage (cross-RG, existing) — for the deployment package blob endpoint
// -----------------------------------------------------------------------------

resource sharedStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
  scope: resourceGroup(storageResourceGroupName)
}

// -----------------------------------------------------------------------------
// App Service Plan — Flex Consumption (FC1, Linux)
// -----------------------------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true // Linux
  }
}

// -----------------------------------------------------------------------------
// Function App (Flex Consumption, Linux, .NET 10 isolated)
// -----------------------------------------------------------------------------

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    functionAppConfig: {
      runtime: {
        name: 'dotnet-isolated'
        version: '10.0'
      }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${sharedStorage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: instanceMemoryMB
        maximumInstanceCount: maximumInstanceCount
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      appSettings: [
        {
          name: 'AzureWebJobsFeatureFlags'
          value: 'EnableWorkerIndexing'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'TELEGRAM_BOT_TOKEN'
          value: '@Microsoft.KeyVault(SecretUri=${botTokenSecretUri})'
        }
        {
          name: 'TELEGRAM_WEBHOOK_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${webhookSecretUri})'
        }
        {
          name: 'AGENT_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${agentApiKeySecretUri})'
        }
        {
          name: 'TELEGRAM_ALLOWED_CHAT_ID'
          value: telegramAllowedChatId
        }
        {
          name: 'TELEGRAM_ALLOWED_USER_IDS'
          value: telegramAllowedUserIds
        }
        {
          name: 'ESPACIOPRO_API_URL'
          value: espacioProApiUrl
        }
        {
          name: 'AGENT_ROUTER'
          value: agentRouter
        }
        {
          name: 'PROJECT_ENDPOINT'
          value: projectEndpoint
        }
        {
          name: 'AGENT_MODEL'
          value: agentModel
        }
        {
          name: 'COGNITIVE_ENDPOINT'
          value: cognitiveEndpoint
        }
      ]
    }
  }
}

// -----------------------------------------------------------------------------
// Diagnostic settings → Log Analytics
// -----------------------------------------------------------------------------

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: functionApp
  name: 'send-to-log-analytics'
  properties: {
    workspaceId: workspaceResourceId
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Resource ID of the agent Function App.')
output functionAppResourceId string = functionApp.id

@description('Default hostname (e.g. func-espaciopro-agent-eus2.azurewebsites.net).')
output functionAppHostname string = functionApp.properties.defaultHostName

@description('Principal ID of the agent system-assigned Managed Identity.')
output functionAppPrincipalId string = functionApp.identity.principalId

@description('Resource ID of the agent App Service Plan.')
output planResourceId string = plan.id
