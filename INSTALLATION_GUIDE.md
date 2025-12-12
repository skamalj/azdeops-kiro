# Azure DevOps Integration - Installation Guide

This project provides Azure DevOps integration in two ways:

## Option 1: For Kiro IDE Users (Recommended)

### Install the Kiro Power

1. **Install the Power:**
   ```
   Use Kiro's Power installation from GitHub: https://github.com/skamalj/azdeops-kiro
   ```

2. **Set Environment Variables:**
   ```bash
   AZURE_DEVOPS_ORG_URL="https://dev.azure.com/skamalj0630"
   AZURE_DEVOPS_PROJECT="PartsUnlimited-CD"
   AZURE_DEVOPS_PAT="Your_Personal_Access_Token"
   ```

3. **Install MCP Server Dependencies:**
   ```bash
   cd mcp-server
   npm install
   ```

4. **Use the Power:**
   - The power will automatically start the MCP server
   - Use Kiro's MCP tools to interact with Azure DevOps

## Option 2: For VS Code Users

### Install the VS Code Extension

1. **Install Extension:**
   - Install the `azure-devops-integration-1.0.0.vsix` file in VS Code
   - Or install from VS Code marketplace (when published)

2. **Configure Settings:**
   - Open VS Code Settings
   - Search for "Azure DevOps"
   - Set your organization URL, project name, and PAT

3. **Use the Extension:**
   - Extension automatically starts MCP server (bundled)
   - Use VS Code's Azure DevOps panel and commands

## Environment Variables

Set these environment variables for authentication:

- `AZURE_DEVOPS_ORG_URL`: Your Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT`: Your project name
- `AZURE_DEVOPS_PAT`: Your Personal Access Token with Work Items permissions

## Getting a Personal Access Token

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with "Work Items (Read & Write)" permissions
3. Copy the token and use it as `AZURE_DEVOPS_PAT`

## Troubleshooting

### MCP Server Connection Issues

If you see "Cannot find module" errors:

1. **For Kiro Power users:**
   ```bash
   cd mcp-server
   npm install
   ```

2. **For VS Code Extension users:**
   - Reinstall the extension (dependencies are bundled)

### Authentication Issues

1. Verify environment variables are set correctly
2. Test your PAT in Azure DevOps web interface
3. Ensure PAT has "Work Items (Read & Write)" permissions

## Architecture

- **VS Code Extension**: Starts MCP server on TCP port 3001 (735KB)
- **Kiro Power**: Connects to running MCP server via TCP
- **MCP Server**: Handles Azure DevOps API communication
- **Connection**: Extension starts server, Power connects to it