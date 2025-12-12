import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class MCPServerService {
  private mcpProcess: cp.ChildProcess | null = null;
  private isRunning: boolean = false;
  private port: number = 3001; // Fixed port for Kiro to connect to

  constructor() {}

  async startMCPServer(): Promise<void> {
    if (this.isRunning) {
      console.log('MCP Server is already running on port', this.port);
      return;
    }

    try {
      // Get the path to the MCP server
      const extensionPath = vscode.extensions.getExtension('kiro.azure-devops-integration')?.extensionPath;
      if (!extensionPath) {
        throw new Error('Could not find extension path');
      }

      const mcpServerPath = path.join(extensionPath, 'mcp-server', 'index.js');
      
      console.log('Starting MCP Server at:', mcpServerPath);
      console.log('MCP Server will listen on port:', this.port);

      // Start the MCP server process with HTTP server mode
      this.mcpProcess = cp.spawn('node', [mcpServerPath, '--http', this.port.toString()], {
        stdio: 'pipe',
        env: {
          ...process.env,
          // Pass through environment variables for Azure DevOps
          AZURE_DEVOPS_ORG_URL: process.env.AZURE_DEVOPS_ORG_URL,
          AZURE_DEVOPS_PROJECT: process.env.AZURE_DEVOPS_PROJECT,
          AZURE_DEVOPS_PAT: process.env.AZURE_DEVOPS_PAT,
          MCP_SERVER_PORT: this.port.toString()
        }
      });

      this.mcpProcess.on('spawn', () => {
        console.log(`MCP Server process started successfully on port ${this.port}`);
        this.isRunning = true;
        
        // Show notification to user
        vscode.window.showInformationMessage(
          `Azure DevOps MCP Server started on port ${this.port}`,
          'Open Kiro Power'
        ).then(selection => {
          if (selection === 'Open Kiro Power') {
            vscode.env.openExternal(vscode.Uri.parse('https://kiro.ai/powers'));
          }
        });
      });

      this.mcpProcess.on('error', (error) => {
        console.error('MCP Server process error:', error);
        this.isRunning = false;
        vscode.window.showErrorMessage(`MCP Server failed to start: ${error.message}`);
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
          console.error('MCP Server stderr:', data.toString());
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

  dispose(): void {
    this.stop();
  }
}