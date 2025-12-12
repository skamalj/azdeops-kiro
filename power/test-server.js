#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server works
 * Run with: node test-server.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Test environment variables (replace with your actual values)
const testEnv = {
  ...process.env,
  AZURE_DEVOPS_ORG_URL: process.env.AZURE_DEVOPS_ORG_URL || 'https://dev.azure.com/testorg',
  AZURE_DEVOPS_PROJECT: process.env.AZURE_DEVOPS_PROJECT || 'TestProject',
  AZURE_DEVOPS_PAT: process.env.AZURE_DEVOPS_PAT || 'test-pat-token'
};

console.log('Testing Azure DevOps MCP Server...');
console.log('Environment:');
console.log(`  Organization: ${testEnv.AZURE_DEVOPS_ORG_URL}`);
console.log(`  Project: ${testEnv.AZURE_DEVOPS_PROJECT}`);
console.log(`  PAT: ${testEnv.AZURE_DEVOPS_PAT ? '[SET]' : '[NOT SET]'}`);
console.log('');

// Start the MCP server
const serverPath = path.join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath, 'azure-devops-core'], {
  env: testEnv,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString().trim());
});

server.on('close', (code) => {
  console.log(`\nServer exited with code ${code}`);
  
  if (code === 0) {
    console.log('✅ MCP Server started successfully!');
  } else {
    console.log('❌ MCP Server failed to start');
  }
});

// Send a test message to the server
setTimeout(() => {
  console.log('\nSending test message...');
  
  const testMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(testMessage) + '\n');
}, 1000);

// Clean up after 5 seconds
setTimeout(() => {
  console.log('\nStopping test...');
  server.kill();
}, 5000);