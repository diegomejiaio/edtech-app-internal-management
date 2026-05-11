// =============================================================================
// modules/role-assignment-cosmos.bicep
// Grants the Function App's system-assigned Managed Identity the
// "Cosmos DB Built-in Data Contributor" data-plane role on the shared
// Cosmos account.
//
// SCOPE: Deploys to the RG of the Cosmos account (e.g. rg-shared-services),
// NOT to rg-espaciopro-prod. Invoke from main.bicep with
// `scope: resourceGroup(sharedServicesRgName)`.
//
// REQUIRES the deployer to have User Access Administrator (or Owner) on
// the shared RG to be able to create role assignments.
//
// NOTE: Data-plane RBAC for Cosmos is NOT a generic Azure role assignment.
// It uses Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments resources,
// referencing the built-in role definition ID 00000000-0000-0000-0000-000000000002
// ("Cosmos DB Built-in Data Contributor"). This grants read+write on every
// container in the account, scoped via roleScope.
// =============================================================================

targetScope = 'resourceGroup'

@description('Name of the pre-existing Cosmos account.')
param cosmosAccountName string

@description('Principal ID (object ID) of the Function App system-assigned Managed Identity.')
param principalId string

@description('Optional friendly suffix for the GUID; lets you re-deploy idempotently when Function App MI is recreated.')
param principalIdLabel string = 'function-app'

// Built-in Cosmos data role: "Cosmos DB Built-in Data Contributor"
// Grants read+write on data plane (no control plane). Per arch §3 + AGENTS.md.
var dataContributorRoleDefinitionId = '00000000-0000-0000-0000-000000000002'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

// Idempotent GUID — derived from (account, principal, role). Re-deploys produce
// the same name; deleting the principal + redeploy with same principal still
// reuses the same assignment (Cosmos rejects duplicates with the same name).
resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, principalId, dataContributorRoleDefinitionId, principalIdLabel)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${dataContributorRoleDefinitionId}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}

@description('Resource ID of the created role assignment.')
output roleAssignmentResourceId string = roleAssignment.id
