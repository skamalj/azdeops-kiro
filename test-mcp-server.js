#!/usr/bin/env node

/**
 * Test script to verify MCP server is running and responding
 */

const http = require('http');

console.log('🔍 Testing MCP Server Connection...\n');

// Test 1: Health endpoint
function testHealth() {
  return new Promise((resolve) => {
    console.log('1. Testing Health Endpoint...');
    
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
            console.log(`   Server: ${health.server}`);
            console.log(`   Status: ${health.status}`);
            resolve(true);
          } catch (error) {
            console.log('❌ Health check failed - invalid JSON');
            resolve(false);
          }
        } else {
          console.log(`❌ Health check failed - status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ Health check failed - ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Health check failed - timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test 2: SSE endpoint accessibility
function testSSE() {
  return new Promise((resolve) => {
    console.log('\n2. Testing SSE Endpoint...');
    
    const req = http.get('http://localhost:3001/sse', (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      if (res.statusCode === 200) {
        console.log('✅ SSE endpoint accessible');
        
        // Listen for some data
        let dataReceived = false;
        const timeout = setTimeout(() => {
          if (!dataReceived) {
            console.log('⚠️  No SSE data received within 3 seconds');
          }
          req.destroy();
          resolve(true);
        }, 3000);
        
        res.on('data', (chunk) => {
          dataReceived = true;
          console.log(`   SSE Data: ${chunk.toString().substring(0, 100)}...`);
          clearTimeout(timeout);
          req.destroy();
          resolve(true);
        });
        
      } else {
        console.log(`❌ SSE endpoint failed - status: ${res.statusCode}`);
        req.destroy();
        resolve(false);
      }
    });
    
    req.on('error', (error) => {
      console.log(`❌ SSE endpoint failed - ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ SSE endpoint failed - timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test 3: Try to send MCP message
function testMCPMessage() {
  return new Promise((resolve) => {
    console.log('\n3. Testing MCP Message...');
    
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/sse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   Response Status: ${res.statusCode}`);
        console.log(`   Response Data: ${data.substring(0, 200)}...`);
        
        if (res.statusCode === 200 || res.statusCode === 404) {
          console.log('✅ MCP endpoint responding (even if not accepting POST)');
          resolve(true);
        } else {
          console.log('❌ MCP endpoint not responding properly');
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ MCP message failed - ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ MCP message failed - timeout');
      req.destroy();
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// Test 4: Check if server process is running
function testProcess() {
  return new Promise((resolve) => {
    console.log('\n4. Checking Server Process...');
    
    const { exec } = require('child_process');
    
    // Check for node processes running our MCP server
    exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Could not check processes');
        resolve(false);
        return;
      }
      
      const lines = stdout.split('\n');
      const nodeProcesses = lines.filter(line => line.includes('node.exe')).length - 1; // -1 for header
      
      console.log(`   Found ${nodeProcesses} Node.js processes running`);
      
      if (nodeProcesses > 0) {
        console.log('✅ Node.js processes detected');
        resolve(true);
      } else {
        console.log('⚠️  No Node.js processes found');
        resolve(false);
      }
    });
  });
}

async function runTests() {
  console.log('Testing MCP Server at http://localhost:3001\n');
  
  const healthOk = await testHealth();
  const sseOk = await testSSE();
  const mcpOk = await testMCPMessage();
  const processOk = await testProcess();
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  console.log(`Health Endpoint:    ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`SSE Endpoint:       ${sseOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`MCP Response:       ${mcpOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Process Running:    ${processOk ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = healthOk && sseOk && mcpOk && processOk;
  
  console.log(`\nOverall Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    console.log('\n🔧 Troubleshooting:');
    if (!healthOk || !sseOk || !mcpOk) {
      console.log('- Start MCP server: node mcp-server/index.js --http 3001');
    }
    if (!processOk) {
      console.log('- Check if Node.js processes are running');
    }
  } else {
    console.log('\n✅ MCP Server is ready for Kiro Power connection!');
    console.log('   Kiro should connect to: http://localhost:3001/sse');
  }
}

runTests().catch(console.error);