# Azure DevOps Power for Kiro

A complete Kiro Power implementation that provides Azure DevOps integration through MCP servers.

## Quick Setup

### 1. Build the Power
```bash
cd power
npm install
npm run build
```

### 2. Configure Environment Variables
```bash
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/yourorg"
export AZURE_DEVOPS_PROJECT="YourProjectName"
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

### 3. Test the MCP Server
```bash
npm run start:core
```

## Available Commands

Once activated in Kiro, you can use natural language commands like:

- **"Create a user story titled 'User login feature' with 8 story points"**
- **"Create a task titled 'Implement authentication' with 6 hours remaining work"**
- **"Show me all active user stories"**
- **"Update work item #123 to set state to Done"**
- **"Get details for work item #456"**

## MCP Server Configuration

Add this to your Kiro MCP configuration:

```json
{
  "mcpServers": {
    "azure-devops-core": {
      "command": "node",
      "args": ["path/to/power/dist/index.js", "azure-devops-core"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/yourorg",
        "AZURE_DEVOPS_PROJECT": "YourProject", 
        "AZURE_DEVOPS_PAT": "your-personal-access-token"
      }
    }
  }
}
```

## Features

✅ **Complete Work Item Management**
- Create user stories with story points
- Create tasks (independent or linked to stories)
- Update work items with patch operations
- Query and filter work items
- Get detailed work item information

✅ **Robust Error Handling**
- Authentication validation
- Network error recovery
- Input validation with clear messages
- Rate limiting support

✅ **Production Ready**
- TypeScript implementation
- Comprehensive type definitions
- Built-in logging and debugging
- Environment-based configuration

## Project Structure

```
power/
├── src/
│   ├── mcp-servers/azure-devops-core.ts    # Main MCP server
│   ├── services/AzureDevOpsApiClient.ts    # Azure DevOps API client
│   ├── types/index.ts                      # Type definitions
│   └── index.ts                            # Entry point
├── steering/                               # Usage guides
├── dist/                                   # Compiled JavaScript
├── POWER.md                                # Complete documentation
└── package.json                            # Configuration
```

## Documentation

- **POWER.md** - Complete power documentation
- **steering/getting-started.md** - Basic usage guide
- **steering/advanced-usage.md** - Advanced patterns and workflows

## Comparison with VS Code Extension

| Feature | VS Code Extension | Kiro Power |
|---------|------------------|------------|
| Work Item Creation | ✅ | ✅ |
| Work Item Updates | ✅ | ✅ |
| Hierarchical Tasks | ✅ | ✅ |
| Tree View | ✅ | N/A (Chat-based) |
| Command Palette | ✅ | N/A (Natural language) |
| Authentication | VS Code Settings | Environment Variables |
| Interface | GUI | Natural Language |
| Integration | VS Code Only | Any Kiro-enabled environment |

Both implementations provide the same core functionality with different interaction models suited to their respective environments.