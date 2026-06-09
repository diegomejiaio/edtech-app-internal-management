// =============================================================================
// modules/agent-shared-access.bicep
// Cross-RG wiring for the Telegram agent against shared-services resources.
//
// SCOPE: Deploys to rg-shared-services (the RG that holds the shared storage
// account and the shared Key Vault). Invoke from main.bicep with
// `scope: resourceGroup(sharedServicesResourceGroupName)`.
//
// Creates:
//   1. The agent deployment package blob container on the shared storage account.
//   2. agent MI   → "Storage Blob Data Owner"  on the shared storage account
//      (identity-based AzureWebJobsStorage + Flex deployment package).
//   3. agent MI   → "Key Vault Secrets User"    on the shared Key Vault
//      (resolve TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET / AGENT_API_KEY).
//   4. backend MI → "Key Vault Secrets User"    on the shared Key Vault
//      (resolve its own AGENT_API_KEY reference).
//
// REQUIRES the deployer to have User Access Administrator (or Owner) on
// rg-shared-services to create the role assignments.
//
// The secret VALUES themselves are created out-of-band (CLI), never in Bicep.
// =============================================================================

targetScope = 'resourceGroup'

@description('Name of the pre-existing shared Storage Account.')
param storageAccountName string

@description('Name of the deployment package container to create for the agent.')
param deploymentContainerName string

@description('Name of the pre-existing shared Key Vault (RBAC-enabled).')
param keyVaultName string

@description('Name of the pre-existing shared Foundry / Cognitive Services (AIServices) account. Empty disables the agent Foundry role assignments.')
param foundryAccountName string = ''

@description('Principal ID (object ID) of the agent Function App MI.')
param agentPrincipalId string

@description('Principal ID (object ID) of the backend Function App MI.')
param backendPrincipalId string

// Built-in roles
var storageBlobDataOwnerRoleDefinitionId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var keyVaultSecretsUserRoleDefinitionId = '4633458b-17de-408a-b874-0445c86b69e6'
// Foundry User: agent threads/runs on the Foundry project.
var foundryUserRoleDefinitionId = '53ca6127-db72-4b80-b1b0-d745d6d5456d'
// Cognitive Services User: keyless Speech fast-transcription on the AIServices account.
var cognitiveServicesUserRoleDefinitionId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

// -----------------------------------------------------------------------------
// Existing shared resources
// -----------------------------------------------------------------------------

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = if (!empty(foundryAccountName)) {
  name: foundryAccountName
}

// -----------------------------------------------------------------------------
// Deployment package container (agent)
// -----------------------------------------------------------------------------

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

// -----------------------------------------------------------------------------
// Role assignments
// -----------------------------------------------------------------------------

resource agentStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, agentPrincipalId, storageBlobDataOwnerRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleDefinitionId)
    principalId: agentPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource agentKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, agentPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: agentPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource backendKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, backendPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: backendPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource agentFoundryUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(foundryAccountName)) {
  scope: foundryAccount
  name: guid(foundryAccount.id, agentPrincipalId, foundryUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', foundryUserRoleDefinitionId)
    principalId: agentPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource agentCognitiveUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(foundryAccountName)) {
  scope: foundryAccount
  name: guid(foundryAccount.id, agentPrincipalId, cognitiveServicesUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleDefinitionId)
    principalId: agentPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Name of the agent deployment package container.')
output deploymentContainerName string = deploymentContainer.name
