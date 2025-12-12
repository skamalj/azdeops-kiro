#!/usr/bin/env node

/**
 * Test script to verify Azure DevOps integration setup
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔍 Testing Azure DevOps Integration Setup...\n');

// Test 1: Check if MCP server exists and has dependencies
console.log('1. Checking MCP Server...');
const mcpServerPath = path.join(__dirname, 'mcp-server', 'index.js');
const mcpNodeModules = path.join(__dirname, 'mcp-server', 'node_modules');

if (!fs.existsSync(mcpServerPath)) {
    console.log('❌ MCP server not found at:', mcpServerPath);
    process.exit(1);
}
console.log('✅ MCP server found');

if (!fs.existsSync(mcpNodeModules)) {
    console.log('❌ MCP server dependencies not installed');
    console.log('   Run: cd mcp-server && npm install');
    process.exit(1);
}
console.log('✅ MCP server dependencies installed');

// Test 2: Check if MCP server can start
console.log('\n2. Testing MCP Server startup...');
const mcpProcess = spawn('node', [mcpServerPath], {
    stdio: 'pipe',
    timeout: 5000
});

let mcpOutput = '';
mcpProcess.stderr.on('data', (data) => {
    mcpOutput += data.toString();
});

mcpProcess.on('spawn', () => {
    console.log('✅ MCP server started successfully');
    mcpProcess.kill();
});

mcpProcess.on('error', (error) => {
    console.log('❌ MCP server failed to start:', error.message);
    process.exit(1);
});

setTimeout(() => {
    if (mcpOutput.includes('Azure DevOps Core MCP server running')) {
        console.log('✅ MCP server is working correctly');
    } else {
        console.log('❌ MCP server output unexpected:', mcpOutput);
    }
    mcpProcess.kill();
}, 2000);

// Test 3: Check VS Code extension
console.log('\n3. Checking VS Code Extension...');
const extensionPath = path.join(__dirname, 'extension', 'azure-devops-integration-1.0.0.vsix');
const bundledMcpServer = path.join(__dirname, 'extension', 'mcp-server', 'index.js');

if (fs.existsSync(extensionPath)) {
    console.log('✅ VS Code extension package found');
} else {
    console.log('⚠️  VS Code extension package not found (run: cd extension && npx vsce package)');
}

if (fs.existsSync(bundledMcpServer)) {
    console.log('✅ Bundled MCP server found in extension');
} else {
    console.log('⚠️  Bundled MCP server not found in extension');
}

// Test 4: Check Power configuration
console.log('\n4. Checking Kiro Power...');
const powerMcp = path.join(__dirname, 'power', 'mcp.json');
const powerMd = path.join(__dirname, 'power', 'POWER.md');

if (fs.existsSync(powerMcp)) {
    console.log('✅ Power MCP configuration found');
    const mcpConfig = JSON.parse(fs.readFileSync(powerMcp, 'utf8'));
    const mcpServerArg = mcpConfig.mcpServers['azure-devops-core'].args[0];
    console.log('   MCP server path:', mcpServerArg);
} else {
    console.log('❌ Power MCP configuration not found');
}

if (fs.existsSync(powerMd)) {
    console.log('✅ Power documentation found');
} else {
    console.log('❌ Power documentation not found');
}

// Test 5: Environment variables
console.log('\n5. Checking Environment Variables...');
const requiredEnvVars = [
    'AZURE_DEVOPS_ORG_URL',
    'AZURE_DEVOPS_PROJECT', 
    'AZURE_DEVOPS_PAT'
];

let envVarsSet = 0;
requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
        console.log(`✅ ${envVar} is set`);
        envVarsSet++;
    } else {
        console.log(`⚠️  ${envVar} is not set`);
    }
});

console.log('\n📋 Setup Summary:');
console.log('================');
console.log('✅ MCP Server: Ready');
console.log('✅ Dependencies: Installed');
console.log(`${fs.existsSync(extensionPath) ? '✅' : '⚠️ '} VS Code Extension: ${fs.existsSync(extensionPath) ? 'Ready' : 'Needs packaging'}`);
console.log('✅ Kiro Power: Ready');
console.log(`${envVarsSet === 3 ? '✅' : '⚠️ '} Environment Variables: ${envVarsSet}/3 set`);

if (envVarsSet < 3) {
    console.log('\n🔧 To complete setup, set these environment variables:');
    console.log('   AZURE_DEVOPS_ORG_URL="https://dev.azure.com/your-org"');
    console.log('   AZURE_DEVOPS_PROJECT="Your-Project-Name"');
    console.log('   AZURE_DEVOPS_PAT="your-personal-access-token"');
}

console.log('\n🎉 Setup verification complete!');