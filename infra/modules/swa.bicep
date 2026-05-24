// =============================================================================
// modules/swa.bicep
// Azure Static Web App (Free tier) for the Next.js 16 static export frontend.
//
// Uses AVM:
//   - br/public:avm/res/web/static-site
//
// NOTES:
//   - Free tier = no managed Functions backend, no staging environments,
//     bring-your-own custom domain (only via apex/CNAME). Enough for v1.
//   - The Function App API is reached directly from the SPA via
//     NEXT_PUBLIC_API_URL=https://<funcapp>.azurewebsites.net ; no SWA "linked
//     backend" wiring is used in v1 because the Function App is HTTP-Anonymous
//     for /health and JWT-protected for everything else (Clerk).
//   - GitHub Actions deploy token must be rotated manually after creation.
//     We deliberately do NOT pass a `repositoryToken` here (no secrets).
// =============================================================================

targetScope = 'resourceGroup'

@description('Workload short name.')
@minLength(3)
@maxLength(20)
param workload string

@description('Environment short name.')
@allowed(['prod', 'dev', 'stg'])
param env string

@description('Azure region short code (used in the resource name).')
@minLength(3)
@maxLength(6)
param regionCode string

@description('Azure region for the SWA. SWA Free is region-restricted; eastus2 is supported.')
@allowed([
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
])
param location string

@description('Tags applied to all resources.')
param tags object

// -----------------------------------------------------------------------------
// Naming (CAF: stapp prefix)
// -----------------------------------------------------------------------------

var swaName = 'stapp-${workload}-${env}-${regionCode}'

// -----------------------------------------------------------------------------
// Static Web App (AVM)
// -----------------------------------------------------------------------------

module swa 'br/public:avm/res/web/static-site:0.6.1' = {
  name: 'deploy-swa'
  params: {
    name: swaName
    location: location
    tags: tags
    sku: 'Free'
    // No GitHub repo wiring at deploy time: deployment token is generated
    // post-deploy via `az staticwebapp secrets list` and stored as a GitHub
    // Actions secret. Avoids committing tokens.
    provider: 'None'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// -----------------------------------------------------------------------------
// Outputs (consumed by main.bicep)
// -----------------------------------------------------------------------------

@description('Resource ID of the Static Web App.')
output swaResourceId string = swa.outputs.resourceId

@description('Default hostname (e.g. <random>.azurestaticapps.net). Add this to CORS_ORIGINS.')
output swaDefaultHostname string = swa.outputs.defaultHostname
