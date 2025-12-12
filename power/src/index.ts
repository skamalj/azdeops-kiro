#!/usr/bin/env node

/**
 * Azure DevOps Power for Kiro
 * 
 * This power provides Azure DevOps integration through MCP servers.
 * It includes tools for creating, updating, and managing work items.
 */

import { AzureDevOpsCoreServer } from './mcp-servers/azure-devops-core.js';

async function main() {
  const serverName = process.argv[2];
  
  switch (serverName) {
    case 'azure-devops-core':
      const coreServer = new AzureDevOpsCoreServer();
      await coreServer.run();
      break;
    
    default:
      console.error('Usage: node dist/index.js <server-name>');
      console.error('Available servers:');
      console.error('  - azure-devops-core: Core Azure DevOps operations');
      process.exit(1);
  }
}

main().catch(console.error);