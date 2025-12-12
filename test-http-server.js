#!/usr/bin/env node

/**
 * Test script to verify HTTP/SSE MCP server setup
 */

const http = require('http');

console.log('🔍 Testing Azure DevOps MCP HTTP Server...\n');

// Test health endpoint
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3001/health', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            console.log('✅ Health check passed');
            console.log('   Server:', health.server);
            console.log('   Status:', health.status);
            console.log('   Version:', health.version);
            resolve(true);
          } catch (error) {
            console.log('❌ Health check failed - invalid JSON:', data);
            resolve(false);
          }
        } else {
          console.log('❌ Health check failed - status:', res.statusCode);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Health check failed - connection error:', error.message);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Health check failed - timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test SSE endpoint
function testSSEEndpoint() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/sse', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ SSE endpoint accessible');
        console.log('   Content-Type:', res.headers['content-type']);
        req.destroy();
        resolve(true);
      } else {
        console.log('❌ SSE endpoint failed - status:', res.statusCode);
        resolve(false);
      }
    });
    
    req.on('error', (error) => {
      console.log('❌ SSE endpoint failed - connection error:', error.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      console.log('❌ SSE endpoint failed - timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('1. Testing Health Endpoint...');
  const healthOk = await testHealthEndpoint();
  
  console.log('\n2. Testing SSE Endpoint...');
  const sseOk = await testSSEEndpoint();
  
  console.log('\n📋 Test Results:');
  console.log('================');
  console.log(`Health Endpoint: ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`SSE Endpoint: ${sseOk ? '✅ PASS' : '❌ FAIL'}`);
  
  if (healthOk && sseOk) {
    console.log('\n🎉 All tests passed! MCP server is ready for Kiro Power connection.');
    console.log('\nKiro Power should connect to: http://localhost:3001/sse');
  } else {
    console.log('\n⚠️  Some tests failed. Make sure the MCP server is running:');
    console.log('   node mcp-server/index.js --http 3001');
  }
}

runTests().catch(console.error);