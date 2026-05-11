// =============================================================================
// modules/cosmos-database.bicep
// SQL database + 2 containers on a PRE-EXISTING Cosmos NoSQL account.
//
// SCOPE: This module deploys to the resource group of the shared Cosmos
// account (e.g. rg-shared-services), NOT to rg-espaciopro-prod. Invoke from
// main.bicep with `scope: resourceGroup(sharedServicesRgName)`.
//
// REQUIRES the deployer to have control-plane permissions on the Cosmos
// account (e.g. Cosmos DB Operator or Contributor on rg-shared-services).
// Data-plane access (RBAC for the Function App MI) is configured by
// modules/role-assignment-cosmos.bicep.
//
// AVM: not used for the account (it would re-create) nor for child resources
// of an `existing` parent. Custom resources are clearer here.
//
// DESIGN reference: docs/02-architecture.md §10 "Resolved architectural items".
//   - PK = /type for both containers
//   - master: unique key = /dedupKey (synthetic; only Student/Teacher set it)
//   - Custom indexing policies + composite indexes
// =============================================================================

targetScope = 'resourceGroup'

@description('Name of the pre-existing Cosmos NoSQL account in this resource group.')
param cosmosAccountName string

@description('Logical SQL database name (e.g. espaciopro for prod, espaciopro-dev for local).')
@minLength(3)
@maxLength(63)
param databaseName string

@description('Tags to merge onto the database resource. Containers inherit account-level billing.')
param tags object = {}

// -----------------------------------------------------------------------------
// Pre-existing Cosmos account (cross-RG reference; the parent never changes).
// -----------------------------------------------------------------------------

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

// -----------------------------------------------------------------------------
// SQL Database (serverless — throughput is per-account, not per-DB).
// -----------------------------------------------------------------------------

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosAccount
  name: databaseName
  tags: tags
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// -----------------------------------------------------------------------------
// Container: master
//   Holds: catalog, student, teacher, schedule
//   PK: /type
//   Unique key: /dedupKey  (path C — see arch §10.1)
//     - Student/Teacher repos populate dedupKey = "{type}:{docType}:{docNumber}"
//     - Catalog/Schedule repos OMIT the field entirely → coexist freely
//   Indexing: custom (excludes verbose / never-filtered fields)
//   Composite: (type ASC, dedupKey ASC) → speeds dedup pre-checks
// -----------------------------------------------------------------------------

resource masterContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: db
  name: 'master'
  properties: {
    resource: {
      id: 'master'
      partitionKey: {
        paths: ['/type']
        kind: 'Hash'
        version: 2
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: ['/dedupKey']
          }
        ]
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/notes/?' }
          { path: '/email/?' }
          { path: '/specialty/?' }
          { path: '/items/[]/value/?' }
          { path: '/"_etag"/?' }
        ]
        compositeIndexes: [
          [
            { path: '/type', order: 'ascending' }
            { path: '/dedupKey', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: -1 // TTL disabled. Soft delete handled in app code.
    }
  }
}

// -----------------------------------------------------------------------------
// Container: operations
//   Holds: enrollment, studentPayment, teacherPayment, expense
//   PK: /type
//   No unique key (no dedup invariant in operations)
//   Indexing: excludes verbose text fields
//   Composites:
//     (type, scheduleId, status)         → enrollment list-by-schedule
//     (type, enrollmentId, date DESC)    → payment history per enrollment
//     (type, scheduleId, date ASC)       → dashboard month queries (M9)
// -----------------------------------------------------------------------------

resource operationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: db
  name: 'operations'
  properties: {
    resource: {
      id: 'operations'
      partitionKey: {
        paths: ['/type']
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/notes/?' }
          { path: '/description/?' }
          { path: '/receiptNumber/?' }
          { path: '/concept/?' }
          { path: '/"_etag"/?' }
        ]
        compositeIndexes: [
          [
            { path: '/type', order: 'ascending' }
            { path: '/scheduleId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          [
            { path: '/type', order: 'ascending' }
            { path: '/enrollmentId', order: 'ascending' }
            { path: '/date', order: 'descending' }
          ]
          [
            { path: '/type', order: 'ascending' }
            { path: '/scheduleId', order: 'ascending' }
            { path: '/date', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs (consumed by main.bicep + role-assignment-cosmos.bicep)
// -----------------------------------------------------------------------------

@description('Resource ID of the Cosmos account (pre-existing).')
output cosmosAccountResourceId string = cosmosAccount.id

@description('Document endpoint of the Cosmos account (https URL). Wired into the Function App as COSMOS_ACCOUNT_ENDPOINT.')
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Database name (just echoes the input; useful for main.bicep wiring).')
output databaseName string = db.name
