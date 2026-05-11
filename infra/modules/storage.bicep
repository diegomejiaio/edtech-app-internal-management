// =============================================================================
// modules/storage.bicep
// Storage Account for the Function App runtime (AzureWebJobsStorage +
// Flex Consumption deployment package container).
//
// Uses AVM:
//   - br/public:avm/res/storage/storage-account
//
// SECURITY:
//   - Identity-based access (no shared keys in app settings).
//   - Function App MI gets Storage Blob Data Owner via the function-app module.
//   - Public network access enabled (no Private Link in v1, per arch §11).
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

@description('Resource ID of the Log Analytics workspace for diagnostic settings.')
param workspaceResourceId string

// -----------------------------------------------------------------------------
// Naming (CAF: st prefix, lowercase, alphanumeric only, max 24 chars)
// -----------------------------------------------------------------------------

// Storage account names are lowercase, no separators, max 24. Uniqueness via
// short subscription suffix to avoid global name collisions across subs.
var storageAccountName = take(toLower('st${workload}${env}${regionCode}${uniqueString(resourceGroup().id)}'), 24)

// Flex Consumption requires a dedicated container for the deployment package.
var deploymentContainerName = 'app-package'

// -----------------------------------------------------------------------------
// Storage Account (AVM)
// -----------------------------------------------------------------------------

module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  name: 'deploy-storage'
  params: {
    name: storageAccountName
    location: location
    tags: tags
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // Functions runtime still requires this for some operations even with MI
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    blobServices: {
      containers: [
        {
          name: deploymentContainerName
          publicAccess: 'None'
        }
      ]
      diagnosticSettings: [
        {
          workspaceResourceId: workspaceResourceId
          logCategoriesAndGroups: [
            { categoryGroup: 'audit' }
          ]
          metricCategories: [
            { category: 'AllMetrics' }
          ]
        }
      ]
    }
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceResourceId
        metricCategories: [
          { category: 'AllMetrics' }
        ]
      }
    ]
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Resource ID of the Storage Account.')
output storageAccountResourceId string = storage.outputs.resourceId

@description('Name of the Storage Account.')
output storageAccountName string = storage.outputs.name

@description('Primary Blob endpoint (used by Flex Consumption deployment.storage.value).')
output blobEndpoint string = storage.outputs.primaryBlobEndpoint

@description('Name of the deployment package container required by Flex Consumption.')
output deploymentContainerName string = deploymentContainerName
