// ── Frontend Container App — Procurement Agent PoC ───────────────────
//
// Deploys the Next.js frontend as a Container App with external ingress.
// The frontend proxies MAF API calls server-side via Next.js API Routes,
// so MAF_BASE_URL points to the internal CA hostname of ca-ai-service.
//
// Easy Auth (Entra ID):
//   When entraClientId is provided, Container Apps built-in auth is enabled.
//   Azure intercepts every request — unauthenticated users are redirected to
//   Microsoft login automatically. Zero code changes in Next.js required.
//
//   Pre-requisite: create an Entra App Registration manually (see main.bicepparam).

// ── Parameters ───────────────────────────────────────────────────────

@description('Azure region')
param location string

@description('Unique suffix shared with other PoC resources')
param suffix string

@description('Container Apps Environment resource ID')
param containerAppsEnvironmentId string

@description('ACR login server, e.g. azacrshared.azurecr.io')
param acrLoginServer string

@description('ACR resource name')
param acrName string

@secure()
@description('ACR admin password — pass at deploy time, never commit')
param acrAdminPassword string

@description('Frontend container image tag, e.g. azacrshared.azurecr.io/procurement-frontend:latest')
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Internal URL of the AI Service Container App (MAF backend)')
param aiServiceInternalUrl string

@description('Internal URL of the MCP Server Container App (procurement data API)')
param mcpServerInternalUrl string

@secure()
@description('Optional auth token forwarded to MAF backend — leave empty to disable')
param mafAuthToken string = ''

@description('Entra App Registration client ID for Easy Auth — leave empty to deploy without auth')
param entraClientId string = ''

@secure()
@description('Entra App Registration client secret for Easy Auth — leave empty to deploy without auth')
param entraClientSecret string = ''

@description('Entra tenant ID — required when entraClientId is provided')
param entraTenantId string = ''

@description('Tags applied to all resources created by this module')
param tags object = {}

@secure()
@description('MCP server API key — required when the MCP server has API_KEY auth enabled')
param mcpApiKey string = ''

// ── Frontend Container App — external ingress on port 3000 ──────────

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-frontend-${suffix}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    workloadProfileName: 'Consumption'

    configuration: {
      // ── ACR pull credentials ──────────────────────────────────────
      registries: [
        {
          server: acrLoginServer
          username: acrName
          passwordSecretRef: 'acr-admin-password'
        }
      ]

      // ── Secrets ───────────────────────────────────────────────────
      secrets: union(
        [
          {
            name: 'acr-admin-password'
            value: acrAdminPassword
          }
        ],
        !empty(mafAuthToken) ? [
          {
            name: 'maf-auth-token'
            value: mafAuthToken
          }
        ] : [],
        !empty(mcpApiKey) ? [
          {
            name: 'mcp-api-key'
            value: mcpApiKey
          }
        ] : [],
        !empty(entraClientSecret) ? [
          {
            name: 'entra-client-secret'
            value: entraClientSecret
          }
        ] : []
      )

      // ── Ingress — public HTTPS on port 3000 ───────────────────────
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
    }

    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: union(
            [
              {
                // Next.js API Route proxy target — internal Container Apps DNS
                name: 'MAF_BASE_URL'
                value: aiServiceInternalUrl
              }
              {
                // Next.js /api/procurement/* proxy target — internal Container Apps DNS
                name: 'MCP_SERVER_URL'
                value: mcpServerInternalUrl
              }
              {
                name: 'PORT'
                value: '3000'
              }
              {
                name: 'HOST'
                value: '0.0.0.0'
              }
              {
                name: 'NODE_ENV'
                value: 'production'
              }
            ],
            !empty(mafAuthToken) ? [
              {
                name: 'MAF_AUTH_TOKEN'
                secretRef: 'maf-auth-token'
              }
            ] : [],
            !empty(mcpApiKey) ? [
              {
                name: 'MCP_API_KEY'
                secretRef: 'mcp-api-key'
              }
            ] : []
          )
        }
      ]

      // ── Scale — PoC: always 1 replica running, max 2 ─────────────────
      // minReplicas: 0 causes KEDA to kill the container before the health
      // check passes on cold start, leading to ActivationFailed loops.
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
  tags: tags
}

// ── Easy Auth — Entra ID (Azure AD) ─────────────────────────────────
//
// Only deployed when entraClientId is provided.
// unauthenticatedClientAction: 'RedirectToLoginPage' — any unauthenticated
// request is intercepted by Azure and redirected to Microsoft login.
// The app never sees unauthenticated traffic.

resource authConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (!empty(entraClientId)) {
  name: 'current'
  parent: frontendApp
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          openIdIssuer: 'https://sts.windows.net/${entraTenantId}/v2.0'
          clientId: entraClientId
          clientSecretSettingName: 'entra-client-secret'
        }
        validation: {
          allowedAudiences: [
            entraClientId
          ]
        }
      }
    }
    login: {
      preserveUrlFragmentsForLogins: true
      cookieExpiration: {
        convention: 'FixedTime'
        timeToExpiration: '08:00:00'
      }
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────

@description('Public FQDN for the frontend (external ingress)')
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn

@description('Full HTTPS URL for the frontend')
output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'

@description('Easy Auth callback URL — use this as the redirect URI in the Entra App Registration')
output authCallbackUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}/.auth/login/aad/callback'
