// Azure Bot Service + Teams channel for the Procurement Agent.
//
// NOTE: The Entra App Registration (msaAppId / tenant) must be created BEFORE
// running this Bicep. See DEPLOYMENT.md for the manual pre-requisite steps.
//
// Usage:
//   Included from main.bicep — not deployed standalone.

// ── Parameters ───────────────────────────────────────────────────────

@description('Azure region — Bot Service is global, but resource group location is used for metadata')
param location string

@description('Tags applied to all resources')
param tags object = {}

@description('Display name shown in Teams and M365 Copilot')
param botDisplayName string = 'Procurement Agent'

@description('Unique suffix shared with other PoC resources')
param suffix string

@description('Public HTTPS endpoint of the AI Service Container App, e.g. https://ca-ai-service-poc01.azurecontainerapps.io')
param aiServiceEndpoint string

@description('Entra App Registration client ID (pre-created manually — see DEPLOYMENT.md)')
param msaAppId string

@description('Entra App Registration tenant ID')
param msaAppTenantId string

// ── Azure Bot Service ─────────────────────────────────────────────────

resource botService 'Microsoft.BotService/botServices@2023-09-15-preview' = {
  name: 'bot-procurement-${suffix}'
  location: 'global'
  kind: 'azurebot'
  sku: {
    name: 'F0'
  }
  properties: {
    displayName: botDisplayName
    // /api/messages is served on the same port 8080 as the DevUI (no VNET required)
    endpoint: '${aiServiceEndpoint}/api/messages'
    msaAppId: msaAppId
    msaAppType: 'SingleTenant'
    msaAppTenantId: msaAppTenantId
    isStreamingSupported: false
  }
  tags: tags
}

// ── Microsoft Teams Channel ───────────────────────────────────────────

resource teamsChannel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: botService
  name: 'MsTeamsChannel'
  location: 'global'
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      isEnabled: true
    }
  }
}

// ── Microsoft 365 / Copilot Channel ──────────────────────────────────
//
// Required for the agent to appear in the M365 Copilot "Agents" sidebar.

resource m365Channel 'Microsoft.BotService/botServices/channels@2023-09-15-preview' = {
  parent: botService
  name: 'M365Extensions'
  location: 'global'
  properties: {
    channelName: 'M365Extensions'
    properties: {
      isEnabled: true
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────

output botServiceName string = botService.name
output botServiceId string = botService.id
output botEndpoint string = botService.properties.endpoint
