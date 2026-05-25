// =============================================================================
// main.bicepparam — prod values for Espacio Pro v1 (East US 2)
//
// Subscription: e3d59e44-d8a4-475a-a285-7433ca42b87f
// Deploy with:
//   az account set --subscription e3d59e44-d8a4-475a-a285-7433ca42b87f
//   az deployment sub what-if  --location eastus2 \
//     --template-file infra/main.bicep --parameters infra/main.bicepparam
//   az deployment sub create   --location eastus2 \
//     --template-file infra/main.bicep --parameters infra/main.bicepparam
// =============================================================================

using './main.bicep'

// Naming
param workload   = 'espaciopro'
param env        = 'prod'
param location   = 'eastus2'
param regionCode = 'eus2'

// Resource groups
param appResourceGroupName             = 'rg-espaciopro-prod'
param sharedServicesResourceGroupName  = 'rg-shared-services'

// Cosmos (account is pre-existing in rg-shared-services)
param cosmosAccountName  = 'shared-cosmos-nosql'
param cosmosDatabaseName = 'espaciopro'

// Clerk (public — JWKS-only, no secrets)
// Update these to match the actual Clerk dev/prod instance before first deploy.
param clerkJwksUrl = 'https://legible-sunfish-48.clerk.accounts.dev/.well-known/jwks.json'
param clerkIssuer  = 'https://legible-sunfish-48.clerk.accounts.dev'

// CORS — deployed SWA plus localhost for dev tooling against the deployed API.
// Localhost is included for dev tooling against the deployed API.
param corsOrigins = 'https://calm-ground-055fb250f.7.azurestaticapps.net,http://localhost:3000'

// Tags (minimal per Q5)
param tags = {
  workload:  'espaciopro'
  env:       'prod'
  managedBy: 'bicep'
}
