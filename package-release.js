#!/usr/bin/env node

/**
 * Release packaging script for Azure DevOps Integration
 * Creates distribution packages for both extension and power
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Packaging Azure DevOps Integration for distribution...\n');

// Create releases directory
const releasesDir = 'releases';
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir);
}

// Package VS Code Extension
console.log('📦 Packaging VS Code Extension...');
try {
  process.chdir('extension');
  execSync('npm run compile', { stdio: 'inherit' });
  execSync('npx vsce package --out ../releases/', { stdio: 'inherit' });
  process.chdir('..');
  console.log('✅ Extension packaged successfully\n');
} catch (error) {
  console.error('❌ Extension packaging failed:', error.message);
}

// Package Kiro Power
console.log('📦 Packaging Kiro Power...');
try {
  process.chdir('power');
  execSync('npm run build', { stdio: 'inherit' });
  process.chdir('..');
  
  // Create power distribution package
  const powerPackage = path.join(releasesDir, 'azure-devops-power-1.0.0.zip');
  execSync(`powershell Compress-Archive -Path power/* -DestinationPath ${powerPackage} -Force`, { stdio: 'inherit' });
  console.log('✅ Power packaged successfully\n');
} catch (error) {
  console.error('❌ Power packaging failed:', error.message);
}

// Create installation guide
const installGuide = `# Azure DevOps Integration - Installation Guide

## VS Code Extension

### Option 1: From VSIX File
1. Download \`azure-devops-integration-1.0.0.vsix\`
2. In VS Code: Extensions → Install from VSIX
3. Select the downloaded file

### Option 2: Command Line
\`\`\`bash
code --install-extension azure-devops-integration-1.0.0.vsix
\`\`\`

## Kiro Power

### Option 1: From ZIP File
1. Download \`azure-devops-power-1.0.0.zip\`
2. Extract to a local folder
3. In Kiro: Powers Panel → Custom Power → Folder
4. Select the extracted folder

### Option 2: From GitHub
1. In Kiro: Powers Panel → Custom Power → GitHub
2. URL: \`https://github.com/username/azure-devops-integration\`
3. Subfolder: \`power\`

## Configuration

### VS Code Extension
Configure in VS Code Settings:
- Azure DevOps Organization URL
- Project Name  
- Personal Access Token

### Kiro Power
Create \`.kiro/settings/mcp.json\`:
\`\`\`json
{
  "mcpServers": {
    "azure-devops-core": {
      "command": "node",
      "args": ["power/dist/index.js", "azure-devops-core"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/yourorg",
        "AZURE_DEVOPS_PROJECT": "YourProject",
        "AZURE_DEVOPS_PAT": "your-pat-token"
      }
    }
  }
}
\`\`\`

## Getting Personal Access Token

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with "Work Items (Read & Write)" permissions
3. Copy the token for configuration
`;

fs.writeFileSync(path.join(releasesDir, 'INSTALLATION.md'), installGuide);

console.log('📋 Distribution packages created in releases/ directory:');
console.log('   - azure-devops-integration-1.0.0.vsix (VS Code Extension)');
console.log('   - azure-devops-power-1.0.0.zip (Kiro Power)');
console.log('   - INSTALLATION.md (Setup guide)');
console.log('\n🎉 Ready for distribution!');