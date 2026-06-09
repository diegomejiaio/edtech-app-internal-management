// =============================================================================
// main.bicep
// Entry point for Espacio Pro v1 infrastructure.
//
// Creates rg-espaciopro-prod and deploys all v1 resources into it, plus a
// new SQL database + 2 containers + role assignment on the pre-existing
// shared Cosmos account in rg-shared-services.
//
// SCOPE: subscription. Run with:
//   az deployment sub create \
//     --location eastus2 \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam
//
// MODULES (deployment order, parallel where safe):
//   monitoring (LA + AppI)
//   storage (account + deployment container)            ┐ parallel
//   swa                                                 │
//   cosmosDatabase + cosmosDevDatabase (cross-RG)        ┘
//   functionApp (depends on monitoring + storage + cosmos endpoint)
//   roleAssignmentCosmos (cross-RG: rg-shared-services; depends on functionApp.principalId)
// =============================================================================

targetScope = 'subscription'

// -----------------------------------------------------------------------------
// Naming params
// -----------------------------------------------------------------------------

@description('Workload short name. Used in all resource names.')
@minLength(3)
@maxLength(20)
param workload string

@description('Environment short name.')
@allowed(['prod', 'dev', 'stg'])
param env string

@description('Azure region (full name) for resource creation.')
param location string

@description('Azure region short code for resource names (e.g. eus2 for East US 2).')
@minLength(3)
@maxLength(6)
param regionCode string

// -----------------------------------------------------------------------------
// RG params
// -----------------------------------------------------------------------------

@description('Resource group name to create for app resources (Function App, SWA, storage, monitoring).')
param appResourceGroupName string

@description('Resource group name where the pre-existing shared Cosmos account lives.')
param sharedServicesResourceGroupName string

// -----------------------------------------------------------------------------
// Cosmos params
// -----------------------------------------------------------------------------

@description('Name of the pre-existing shared Cosmos NoSQL account (in sharedServicesResourceGroupName).')
param cosmosAccountName string

@description('Name of the SQL database to create on the Cosmos account.')
param cosmosDatabaseName string

@description('Optional local/E2E SQL database name to create with the same containers. Leave empty to skip.')
param localDevCosmosDatabaseName string = ''

// -----------------------------------------------------------------------------
// Clerk params
// -----------------------------------------------------------------------------

@description('Clerk JWKS endpoint URL (public, no secret). Example: https://clerk.<domain>/.well-known/jwks.json')
param clerkJwksUrl string

@description('Clerk issuer URL. Example: https://clerk.<domain>')
param clerkIssuer string

// -----------------------------------------------------------------------------
// CORS params
// -----------------------------------------------------------------------------

@description('Comma-separated CORS allowlist for the API. Include the SWA hostname after first deploy.')
param corsOrigins string

// -----------------------------------------------------------------------------
// Telegram agent params (non-secret only — secret VALUES live in Key Vault)
// -----------------------------------------------------------------------------

@description('Name of the pre-existing shared Key Vault (RBAC-enabled) holding agent secrets.')
param keyVaultName string

@description('Name of the pre-existing shared Storage Account reused for the agent deployment package.')
param agentStorageAccountName string

@description('Name of the agent deployment package container (created on the shared storage account).')
param agentDeploymentContainerName string = 'app-package-agent'

@description('Key Vault secret name for the Telegram bot token.')
param telegramBotTokenSecretName string = 'telegram-bot-token'

@description('Key Vault secret name for the Telegram webhook secret.')
param telegramWebhookSecretName string = 'telegram-webhook-secret'

@description('Key Vault secret name for the agent service key (X-Agent-Key).')
param agentApiKeySecretName string = 'agent-api-key'

@description('Telegram allowed group chat id (comma-separated). Not a secret.')
param telegramAllowedChatId string

@description('Telegram allowed user ids (comma-separated). Not a secret.')
param telegramAllowedUserIds string

@description('Base URL of the backend API the agent calls. Defaults to the prod Function App.')
param agentEspacioProApiUrl string = 'https://func-${workload}-${env}-${regionCode}.azurewebsites.net'

@description('Agent router implementation selector.')
param agentRouter string = 'deterministic'

@description('Foundry project endpoint for the agent (PROJECT_ENDPOINT).')
param agentProjectEndpoint string = ''

@description('Foundry model deployment name for the agent (AGENT_MODEL). Vision-capable.')
param agentModel string = 'gpt-4.1'

@description('Cognitive Services endpoint for Speech fast-transcription (COGNITIVE_ENDPOINT).')
param agentCognitiveEndpoint string = ''

@description('Name of the shared Foundry / AIServices account (in sharedServicesResourceGroupName) the agent MI is granted access to. Empty disables the Foundry role assignments.')
param foundryAccountName string = ''

@description('App Service Plan name for the agent. Set to the pre-existing plan to avoid Flex move conflicts; leave empty to use the default clean name.')
param agentPlanName string = ''

// -----------------------------------------------------------------------------
// Tags
// -----------------------------------------------------------------------------

@description('Tags applied to RG and propagated to all resources.')
param tags object

// -----------------------------------------------------------------------------
// Key Vault secret references (constructed; values created out-of-band via CLI)
// -----------------------------------------------------------------------------

var keyVaultBaseUri = 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/'
var telegramBotTokenSecretUri = '${keyVaultBaseUri}secrets/${telegramBotTokenSecretName}'
var telegramWebhookSecretUri = '${keyVaultBaseUri}secrets/${telegramWebhookSecretName}'
var agentApiKeySecretUri = '${keyVaultBaseUri}secrets/${agentApiKeySecretName}'

// -----------------------------------------------------------------------------
// Resource Group (app resources)
// -----------------------------------------------------------------------------

resource appRg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: appResourceGroupName
  location: location
  tags: tags
}

// -----------------------------------------------------------------------------
// Monitoring (LA + AppI) — must precede storage/function-app for diagnostics
// -----------------------------------------------------------------------------

module monitoring 'modules/monitoring.bicep' = {
  scope: appRg
  name: 'monitoring'
  params: {
    workload: workload
    env: env
    regionCode: regionCode
    location: location
    tags: tags
  }
}

// -----------------------------------------------------------------------------
// Storage (Functions runtime + Flex Consumption deployment package container)
// -----------------------------------------------------------------------------

module storage 'modules/storage.bicep' = {
  scope: appRg
  name: 'storage'
  params: {
    workload: workload
    env: env
    regionCode: regionCode
    location: location
    tags: tags
    workspaceResourceId: monitoring.outputs.workspaceResourceId
  }
}

// -----------------------------------------------------------------------------
// Static Web App
// -----------------------------------------------------------------------------

module swa 'modules/swa.bicep' = {
  scope: appRg
  name: 'swa'
  params: {
    workload: workload
    env: env
    regionCode: regionCode
    location: location
    tags: tags
  }
}

// -----------------------------------------------------------------------------
// Cosmos DB + 2 containers (cross-RG, deploys to rg-shared-services)
// -----------------------------------------------------------------------------

module cosmosDatabase 'modules/cosmos-database.bicep' = {
  scope: resourceGroup(sharedServicesResourceGroupName)
  name: 'cosmos-database'
  params: {
    cosmosAccountName: cosmosAccountName
    databaseName: cosmosDatabaseName
    tags: tags
  }
}

module cosmosDevDatabase 'modules/cosmos-database.bicep' = if (!empty(localDevCosmosDatabaseName)) {
  scope: resourceGroup(sharedServicesResourceGroupName)
  name: 'cosmos-database-dev'
  params: {
    cosmosAccountName: cosmosAccountName
    databaseName: localDevCosmosDatabaseName
    tags: union(tags, {
      env: 'dev'
    })
  }
}

// -----------------------------------------------------------------------------
// Function App (depends on monitoring + storage + cosmos endpoint)
// -----------------------------------------------------------------------------

module functionApp 'modules/function-app.bicep' = {
  scope: appRg
  name: 'function-app'
  params: {
    workload: workload
    env: env
    regionCode: regionCode
    location: location
    tags: tags
    workspaceResourceId: monitoring.outputs.workspaceResourceId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    storageAccountName: storage.outputs.storageAccountName
    storageBlobEndpoint: storage.outputs.blobEndpoint
    deploymentContainerName: storage.outputs.deploymentContainerName
    cosmosAccountEndpoint: cosmosDatabase.outputs.cosmosAccountEndpoint
    cosmosDatabaseName: cosmosDatabase.outputs.databaseName
    clerkJwksUrl: clerkJwksUrl
    clerkIssuer: clerkIssuer
    corsOrigins: corsOrigins
    agentApiKeySecretUri: agentApiKeySecretUri
  }
}

// -----------------------------------------------------------------------------
// Cross-RG: Cosmos data-plane role assignment for Function App MI
// (deploys to rg-shared-services; deployer needs User Access Administrator there)
// -----------------------------------------------------------------------------

module roleAssignmentCosmos 'modules/role-assignment-cosmos.bicep' = {
  scope: resourceGroup(sharedServicesResourceGroupName)
  name: 'role-assignment-cosmos'
  params: {
    cosmosAccountName: cosmosAccountName
    principalId: functionApp.outputs.functionAppPrincipalId
    principalIdLabel: functionApp.name
  }
}

// -----------------------------------------------------------------------------
// Telegram agent Function App (separate Flex app; secrets via Key Vault refs)
// -----------------------------------------------------------------------------

module agentFunctionApp 'modules/agent-function-app.bicep' = {
  scope: appRg
  name: 'agent-function-app'
  params: {
    workload: workload
    regionCode: regionCode
    location: location
    tags: tags
    workspaceResourceId: monitoring.outputs.workspaceResourceId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    storageAccountName: agentStorageAccountName
    storageResourceGroupName: sharedServicesResourceGroupName
    deploymentContainerName: agentDeploymentContainerName
    botTokenSecretUri: telegramBotTokenSecretUri
    webhookSecretUri: telegramWebhookSecretUri
    agentApiKeySecretUri: agentApiKeySecretUri
    telegramAllowedChatId: telegramAllowedChatId
    telegramAllowedUserIds: telegramAllowedUserIds
    espacioProApiUrl: agentEspacioProApiUrl
    agentRouter: agentRouter
    projectEndpoint: agentProjectEndpoint
    agentModel: agentModel
    cognitiveEndpoint: agentCognitiveEndpoint
    planName: empty(agentPlanName) ? 'asp-${workload}-agent-${regionCode}' : agentPlanName
  }
}

// -----------------------------------------------------------------------------
// Cross-RG: agent deployment container + Blob/Key Vault role assignments
// (deploys to rg-shared-services; deployer needs User Access Administrator)
// -----------------------------------------------------------------------------

module agentSharedAccess 'modules/agent-shared-access.bicep' = {
  scope: resourceGroup(sharedServicesResourceGroupName)
  name: 'agent-shared-access'
  params: {
    storageAccountName: agentStorageAccountName
    deploymentContainerName: agentDeploymentContainerName
    keyVaultName: keyVaultName
    foundryAccountName: foundryAccountName
    agentPrincipalId: agentFunctionApp.outputs.functionAppPrincipalId
    backendPrincipalId: functionApp.outputs.functionAppPrincipalId
  }
}

// -----------------------------------------------------------------------------
// Outputs (for CI/CD wiring + documentation)
// -----------------------------------------------------------------------------

@description('Name of the app resource group.')
output appResourceGroupName string = appRg.name

@description('Function App default hostname.')
output functionAppHostname string = functionApp.outputs.functionAppHostname

@description('Function App resource ID.')
output functionAppResourceId string = functionApp.outputs.functionAppResourceId

@description('Function App MI principal ID (object ID).')
output functionAppPrincipalId string = functionApp.outputs.functionAppPrincipalId

@description('Static Web App default hostname.')
output swaHostname string = swa.outputs.swaDefaultHostname

@description('Static Web App resource ID.')
output swaResourceId string = swa.outputs.swaResourceId

@description('Cosmos account document endpoint (wired into Function App).')
output cosmosAccountEndpoint string = cosmosDatabase.outputs.cosmosAccountEndpoint

@description('Cosmos database name.')
output cosmosDatabaseName string = cosmosDatabase.outputs.databaseName

@description('Local/E2E Cosmos database name, when deployed.')
output localDevCosmosDatabaseName string = !empty(localDevCosmosDatabaseName) ? cosmosDevDatabase!.outputs.databaseName : ''

@description('Application Insights connection string (sensitive — for CI/CD reference only).')
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString

@description('Storage account name (used by Functions runtime).')
output storageAccountName string = storage.outputs.storageAccountName

@description('Telegram agent Function App default hostname.')
output agentFunctionAppHostname string = agentFunctionApp.outputs.functionAppHostname

@description('Telegram agent Function App MI principal ID (object ID).')
output agentFunctionAppPrincipalId string = agentFunctionApp.outputs.functionAppPrincipalId
