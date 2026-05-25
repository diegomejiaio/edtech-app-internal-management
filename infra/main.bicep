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
//   cosmosDatabase (cross-RG: rg-shared-services)       ┘
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
// Tags
// -----------------------------------------------------------------------------

@description('Tags applied to RG and propagated to all resources.')
param tags object

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

@description('Application Insights connection string (sensitive — for CI/CD reference only).')
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString

@description('Storage account name (used by Functions runtime).')
output storageAccountName string = storage.outputs.storageAccountName
