import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class MCPServerService {
  private mcpProcess: cp.ChildProcess | null = null;
  private isRunning: boolean = false;
  private port: number = 3001;

  constructor() {
    // Get port from settings
    const config = vscode.workspace.getConfiguration('azureDevOps.mcpServer');
    this.port = config.get<number>('port', 3001);
  }

  async startMCPServer(): Promise<void> {
    console.log('MCPServerService.startMCPServer() called');
    
    // Check if MCP server is enabled
    const config = vscode.workspace.getConfiguration('azureDevOps.mcpServer');
    const enabled = config.get<boolean>('enabled', true);
    
    console.log('MCP Server enabled:', enabled);
    console.log('MCP Server config:', config);
    
    if (!enabled) {
      console.log('MCP Server is disabled in settings');
      vscode.window.showInformationMessage('MCP Server is disabled in settings');
      return;
    }

    if (this.isRunning) {
      console.log('MCP Server is already running on port', this.port);
      vscode.window.showInformationMessage(`MCP Server already running on port ${this.port}`);
      return;
    }

    try {
      // Update port from settings
      this.port = config.get<number>('port', 3001);
      
      // Get the path to the MCP server
      const extension = vscode.extensions.getExtension('skamalj.compass');
      console.log('Extension found:', !!extension);
      console.log('Extension path:', extension?.extensionPath);
      
      const extensionPath = extension?.extensionPath;
      if (!extensionPath) {
        throw new Error('Could not find extension path for skamalj.compass');
      }

      const mcpServerPath = path.join(extensionPath, 'mcp-server', 'index.js');
      
      console.log('Starting MCP Server at:', mcpServerPath);
      console.log('MCP Server will listen on port:', this.port);
      
      // Check if MCP server file exists
      const fs = require('fs');
      if (!fs.existsSync(mcpServerPath)) {
        throw new Error(`MCP Server file not found at: ${mcpServerPath}`);
      }
      console.log('MCP Server file exists:', mcpServerPath);
      
      // Check if node_modules exists in mcp-server directory
      const mcpServerDir = path.join(extensionPath, 'mcp-server');
      const nodeModulesPath = path.join(mcpServerDir, 'node_modules');
      
      if (!fs.existsSync(nodeModulesPath)) {
        console.log('Installing MCP server dependencies...');
        vscode.window.showInformationMessage('Installing MCP server dependencies...', 'Installing');
        
        // Install dependencies
        const { execSync } = require('child_process');
        try {
          console.log('Running npm install in:', mcpServerDir);
          execSync('npm install', { 
            cwd: mcpServerDir, 
            stdio: 'inherit',
            timeout: 60000 // 60 second timeout
          });
          console.log('MCP server dependencies installed successfully');
          vscode.window.showInformationMessage('✅ MCP server dependencies installed successfully');
        } catch (installError) {
          console.error('Failed to install dependencies:', installError);
          throw new Error(`Failed to install MCP server dependencies: ${installError}`);
        }
      }

      // Verify critical dependencies exist
      const criticalDeps = [
        '@modelcontextprotocol/sdk',
        'express'
      ];
      
      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          console.log(`Missing critical dependency: ${dep}, attempting to install...`);
          const { execSync } = require('child_process');
          try {
            execSync(`npm install ${dep}`, { 
              cwd: mcpServerDir, 
              stdio: 'inherit',
              timeout: 30000
            });
            console.log(`Successfully installed ${dep}`);
          } catch (depError) {
            throw new Error(`Failed to install critical dependency ${dep}: ${depError}`);
          }
        }
      }

      // Start the MCP server process with HTTP server mode
      this.mcpProcess = cp.spawn('node', [mcpServerPath, '--http', this.port.toString()], {
        stdio: 'pipe',
        cwd: mcpServerDir, // Set working directory to mcp-server folder
        env: {
          ...process.env,
          // Pass through environment variables for Azure DevOps
          AZURE_DEVOPS_ORG_URL: process.env.AZURE_DEVOPS_ORG_URL,
          AZURE_DEVOPS_PROJECT: process.env.AZURE_DEVOPS_PROJECT,
          AZURE_DEVOPS_PAT: process.env.AZURE_DEVOPS_PAT,
          MCP_SERVER_PORT: this.port.toString(),
          NODE_PATH: path.join(mcpServerDir, 'node_modules') // Ensure Node can find modules
        }
      });

      this.mcpProcess.on('spawn', () => {
        console.log(`MCP Server process started successfully on port ${this.port}`);
        this.isRunning = true;
        
        // Show notification to user with more options
        vscode.window.showInformationMessage(
          `🚀 Compass MCP Server started on port ${this.port}`,
          'Test Health Check',
          'Open Kiro Power',
          'View Logs'
        ).then(selection => {
          if (selection === 'Test Health Check') {
            vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${this.port}/health`));
          } else if (selection === 'Open Kiro Power') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/skamalj/azdeops-kiro/tree/main/power'));
          } else if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
          }
        });
      });

      this.mcpProcess.on('error', (error) => {
        console.error('MCP Server process error:', error);
        this.isRunning = false;
        
        // Show detailed error message
        let errorDetails = error.message;
        if (error.message.includes('MODULE_NOT_FOUND')) {
          errorDetails = 'Missing dependencies. The extension will attempt to install them automatically on next start.';
        }
        
        vscode.window.showErrorMessage(
          `❌ MCP Server failed to start: ${errorDetails}`,
          'Check Settings',
          'Reinstall Dependencies',
          'View Logs'
        ).then(selection => {
          if (selection === 'Check Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'azureDevOps.mcpServer');
          } else if (selection === 'Reinstall Dependencies') {
            this.reinstallDependencies();
          } else if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
          }
        });
      });

      this.mcpProcess.on('exit', (code, signal) => {
        console.log(`MCP Server process exited with code ${code} and signal ${signal}`);
        this.isRunning = false;
        this.mcpProcess = null;
        
        if (code !== 0) {
          vscode.window.showWarningMessage(`MCP Server stopped unexpectedly (code: ${code})`);
        }
      });

      // Log output for debugging
      if (this.mcpProcess.stdout) {
        this.mcpProcess.stdout.on('data', (data) => {
          console.log('MCP Server stdout:', data.toString());
        });
      }

      if (this.mcpProcess.stderr) {
        this.mcpProcess.stderr.on('data', (data) => {
          const errorText = data.toString();
          console.error('MCP Server stderr:', errorText);
          
          // Check for specific error patterns
          if (errorText.includes('Cannot find module')) {
            console.error('🚨 Module not found error detected - dependencies may be missing');
          }
          if (errorText.includes('✅ Azure DevOps Core MCP server running')) {
            console.log('🎉 MCP Server started successfully!');
          }
        });
      }

    } catch (error) {
      console.error('Failed to start MCP Server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.mcpProcess) {
      console.log('Stopping MCP Server process...');
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isRunning = false;
    }
  }

  getPort(): number {
    return this.port;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  private async reinstallDependencies(): Promise<void> {
    try {
      const extension = vscode.extensions.getExtension('skamalj.compass');
      if (!extension) {
        throw new Error('Could not find extension');
      }

      const mcpServerDir = path.join(extension.extensionPath, 'mcp-server');
      const nodeModulesPath = path.join(mcpServerDir, 'node_modules');
      
      // Remove existing node_modules
      const fs = require('fs');
      if (fs.existsSync(nodeModulesPath)) {
        console.log('Removing existing node_modules...');
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }
      
      // Reinstall dependencies
      vscode.window.showInformationMessage('🔄 Reinstalling MCP server dependencies...');
      
      const { execSync } = require('child_process');
      execSync('npm install', { 
        cwd: mcpServerDir, 
        stdio: 'inherit',
        timeout: 120000 // 2 minute timeout
      });
      
      vscode.window.showInformationMessage('✅ Dependencies reinstalled successfully. Please restart the extension.');
      
    } catch (error) {
      console.error('Failed to reinstall dependencies:', error);
      vscode.window.showErrorMessage(`Failed to reinstall dependencies: ${error}`);
    }
  }

  dispose(): void {
    this.stop();
  }
}