// =============================================================================
// modules/monitoring.bicep
// Log Analytics workspace + Application Insights (workspace-backed)
//
// Uses AVM (Azure Verified Modules) where available:
//   - br/public:avm/res/operational-insights/workspace
//   - br/public:avm/res/insights/component
// =============================================================================

targetScope = 'resourceGroup'

@description('Workload short name. Used in resource names. Example: espaciopro')
@minLength(3)
@maxLength(20)
param workload string

@description('Environment short name. Example: prod')
@allowed(['prod', 'dev', 'stg'])
param env string

@description('Azure region short code (e.g. eus2 for East US 2). Used in resource names.')
@minLength(3)
@maxLength(6)
param regionCode string

@description('Azure region (full name) for resource location.')
param location string

@description('Tags applied to all resources.')
param tags object

// -----------------------------------------------------------------------------
// Naming (CAF-aligned)
// -----------------------------------------------------------------------------

var workspaceName = 'log-${workload}-${env}-${regionCode}'
var appInsightsName = 'appi-${workload}-${env}-${regionCode}'

// -----------------------------------------------------------------------------
// Log Analytics workspace (AVM)
// PerGB2018 + 30-day retention is the cheapest baseline; <$5/mo at v1 traffic.
// -----------------------------------------------------------------------------

module workspace 'br/public:avm/res/operational-insights/workspace:0.7.0' = {
  name: 'deploy-log-workspace'
  params: {
    name: workspaceName
    location: location
    tags: tags
    skuName: 'PerGB2018'
    dataRetention: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// -----------------------------------------------------------------------------
// Application Insights (workspace-backed) (AVM)
// "web" kind covers Function App + SWA telemetry.
// -----------------------------------------------------------------------------

module appInsights 'br/public:avm/res/insights/component:0.4.1' = {
  name: 'deploy-app-insights'
  params: {
    name: appInsightsName
    location: location
    tags: tags
    workspaceResourceId: workspace.outputs.resourceId
    applicationType: 'web'
    kind: 'web'
    disableLocalAuth: false
  }
}

// -----------------------------------------------------------------------------
// Outputs (consumed by main.bicep + function-app.bicep)
// -----------------------------------------------------------------------------

@description('Resource ID of the Log Analytics workspace (used for diagnostic settings).')
output workspaceResourceId string = workspace.outputs.resourceId

@description('Resource ID of the Application Insights component.')
output appInsightsResourceId string = appInsights.outputs.resourceId

@description('Application Insights connection string. Wired into Function App as APPLICATIONINSIGHTS_CONNECTION_STRING.')
output appInsightsConnectionString string = appInsights.outputs.connectionString
