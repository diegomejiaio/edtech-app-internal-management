// =============================================================================
// modules/function-app.bicep
// Flex Consumption (FC1) plan + Linux Function App + system-assigned MI.
// .NET 10 isolated worker.
//
// Direct Azure resources (NOT AVM) because Flex Consumption requires a
// specific siteConfig.functionAppConfig shape (runtime + deployment.storage +
// scaleAndConcurrency) that AVM web/site abstracts loosely. Direct keeps the
// contract explicit and version-pinned.
//
// AzureWebJobsStorage uses **identity-based** access via the Function App MI
// (no shared keys in app settings). The function-app module declares one role
// assignment (Storage Blob Data Owner) on the supplied Storage Account so the
// runtime can read/write its package + host state.
//
// Cosmos role assignment (Built-in Data Contributor) is cross-RG and lives in
// modules/role-assignment-cosmos.bicep, invoked from main.bicep with the
// principalId emitted by this module.
// =============================================================================

targetScope = 'resourceGroup'

@description('Workload short name.')
@minLength(3)
@maxLength(20)
param workload string

@description('Environment short name.')
@allowed(['prod', 'dev', 'stg'])
param env string

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

@description('Name of the Storage Account used by the Functions runtime.')
param storageAccountName string

@description('Primary Blob endpoint of the Storage Account.')
param storageBlobEndpoint string

@description('Name of the deployment package container in the Storage Account.')
param deploymentContainerName string

@description('Cosmos account document endpoint. Wired as COSMOS_ACCOUNT_ENDPOINT.')
param cosmosAccountEndpoint string

@description('Cosmos database name. Wired as COSMOS_DATABASE_NAME.')
param cosmosDatabaseName string

@description('Clerk JWKS URL. Wired as CLERK_JWKS_URL.')
param clerkJwksUrl string

@description('Clerk issuer URL. Wired as CLERK_ISSUER.')
param clerkIssuer string

@description('CORS allowlist (comma-separated). Wired as CORS_ORIGINS. Read by EspacioPro.Api/Program.cs middleware (per arch §8.1). NOT applied at the Functions runtime level.')
param corsOrigins string

@description('Maximum instance count for Flex Consumption. Default 40 (max 1000).')
@minValue(40)
@maxValue(1000)
param maximumInstanceCount int = 40

@description('Instance memory in MB for Flex Consumption. Allowed: 512, 2048, 4096.')
@allowed([512, 2048, 4096])
param instanceMemoryMB int = 2048

// -----------------------------------------------------------------------------
// Naming
// -----------------------------------------------------------------------------

var planName = 'asp-${workload}-${env}-${regionCode}'
var functionAppName = 'func-${workload}-${env}-${regionCode}'

// Built-in role: Storage Blob Data Owner (data plane on storage account)
// Required by Functions runtime when AzureWebJobsStorage uses identity.
var storageBlobDataOwnerRoleDefinitionId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

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
          value: '${storageBlobEndpoint}${deploymentContainerName}'
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
      // CORS is configured in app code (Program.cs middleware), per arch §8.1.
      // We deliberately leave the Functions runtime CORS allowlist empty.
      cors: {
        allowedOrigins: []
        supportCredentials: false
      }
      appSettings: [
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
          name: 'COSMOS_ACCOUNT_ENDPOINT'
          value: cosmosAccountEndpoint
        }
        {
          name: 'COSMOS_DATABASE_NAME'
          value: cosmosDatabaseName
        }
        {
          name: 'CLERK_JWKS_URL'
          value: clerkJwksUrl
        }
        {
          name: 'CLERK_ISSUER'
          value: clerkIssuer
        }
        {
          name: 'CORS_ORIGINS'
          value: corsOrigins
        }
      ]
    }
  }
}

// -----------------------------------------------------------------------------
// Role assignment: Function App MI → Storage Blob Data Owner on its storage
// account (required for identity-based AzureWebJobsStorage on Flex Consumption).
// -----------------------------------------------------------------------------

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource storageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, functionApp.id, storageBlobDataOwnerRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleDefinitionId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
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
// Outputs (consumed by main.bicep + role-assignment-cosmos.bicep)
// -----------------------------------------------------------------------------

@description('Resource ID of the Function App.')
output functionAppResourceId string = functionApp.id

@description('Default hostname (e.g. func-espaciopro-prod-eus2.azurewebsites.net).')
output functionAppHostname string = functionApp.properties.defaultHostName

@description('Principal ID of the system-assigned Managed Identity. Used by the cross-RG Cosmos role assignment.')
output functionAppPrincipalId string = functionApp.identity.principalId

@description('Resource ID of the App Service Plan.')
output planResourceId string = plan.id
