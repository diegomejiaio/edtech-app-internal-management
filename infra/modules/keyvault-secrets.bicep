// Stores PoC secrets in the shared Key Vault.

param keyVaultName string
param aiServicesName string
param searchServiceName string
param searchServiceRgName string
param cosmosAccountName string = ''
param cosmosAccountRgName string = ''

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: aiServicesName
}

resource searchService 'Microsoft.Search/searchServices@2024-06-01-preview' existing = {
  name: searchServiceName
  scope: resourceGroup(searchServiceRgName)
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = if (!empty(cosmosAccountName)) {
  name: cosmosAccountName
  scope: resourceGroup(cosmosAccountRgName)
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource aiServicesKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'procurement-ai-services-key'
  properties: {
    value: aiServices.listKeys().key1
  }
}

resource searchKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'procurement-search-key'
  properties: {
    value: searchService.listAdminKeys().primaryKey
  }
}

resource cosmosKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(cosmosAccountName)) {
  parent: keyVault
  name: 'procurement-cosmos-key'
  properties: {
    value: cosmosAccount.listKeys().primaryMasterKey
  }
}
