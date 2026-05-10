using 'main.bicep'

param location = 'eastus2'
param suffix = 'poc01'
param sharedRgName = 'rg-shared-services'
param sharedAiServicesName = 'aifoundrysharedservices00001'
param sharedKeyVaultName = 'kv-shared-services-00001'
param sharedStorageAccountName = 'sasharedservices00001'
param chatDeploymentName = 'gpt-4.1'
param acrName = 'azacrshared'

// ACR admin password — passed at deploy time via --parameters acrAdminPassword=<secret>
// Never commit a value here.

// ── Frontend Easy Auth (Entra ID) ───────────────────────────────────
// Pre-requisite: create the App Registration once:
//
//   # 1. Create the app (note the appId in the output)
//   az ad app create --display-name "procurement-frontend" \
//     --sign-in-audience AzureADMyOrg
//
//   # 2. Add the redirect URI after first deploy (you need the CA FQDN first):
//   az ad app update --id <appId> \
//     --web-redirect-uris "https://<ca-frontend-fqdn>/.auth/login/aad/callback"
//
//   # 3. Enable id_token issuance (REQUIRED for Easy Auth hybrid flow):
//   az rest --method PATCH \
//     --uri "https://graph.microsoft.com/v1.0/applications(appId='<appId>')" \
//     --body '{"web":{"implicitGrantSettings":{"enableIdTokenIssuance":true}},"api":{"requestedAccessTokenVersion":2}}'
//
//   # 4. Create a client secret (copy the value — shown only once):
//   az ad app credential reset --id <appId> --years 2
//
//   # Then pass at deploy time:
//   --parameters frontendEntraClientId="<appId>" \
//               frontendEntraClientSecret="<secret>" \
//               frontendEntraTenantId="<tenantId>"
//
// Leave all three empty to deploy without auth (open access).

// ── Application Insights / Azure Monitor ───────────────────────────
// Enables traces, metrics, and logs visible in AI Foundry tracing.
//
// Get the connection string:
//   az monitor app-insights component show \
//     --app ap-in-poc-procurement \
//     --resource-group rg-procurement-agent-poc \
//     --query connectionString -o tsv
//
// Then pass at deploy time:
//   --parameters appInsightsConnectionString="InstrumentationKey=...;IngestionEndpoint=..."
//
// ── MCP Server API Key ──────────────────────────────────────────────
// Required for X-API-Key authentication on the MCP server.
// Retrieve the current key from the container app env vars:
//
//   az containerapp show \
//     --name ca-mcp-server-poc01 \
//     --resource-group rg-procurement-agent-poc \
//     --query "properties.template.containers[0].env[?name=='API_KEY'].value" -o tsv
//
// Then pass at deploy time:
//   --parameters mcpApiKey="<your-api-key>"
//
// Leave empty to deploy without auth (open access).

