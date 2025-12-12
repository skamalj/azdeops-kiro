# Azure DevOps Power

A comprehensive Kiro Power for Azure DevOps integration, providing seamless work item management through MCP servers.

## Overview

The Azure DevOps Power enables developers to manage Azure DevOps work items directly from Kiro using the Model Context Protocol (MCP). This power provides the same functionality as the VS Code extension but through Kiro's native Powers framework.

## Features

### Work Item Management
- **Create User Stories**: Define requirements with story points and descriptions
- **Create Tasks**: Independent tasks or linked to parent user stories  
- **Update Work Items**: Modify titles, descriptions, states, and assignments
- **View Work Items**: Browse and search across all accessible work items
- **Hierarchical Structure**: Support for parent-child relationships

### Authentication & Configuration
- **Personal Access Token**: Secure PAT-based authentication
- **Organization Support**: Connect to any Azure DevOps organization
- **Project Selection**: Work with specific projects
- **Settings Persistence**: Secure credential storage

### Advanced Features
- **Real-time Sync**: Immediate updates with Azure DevOps
- **Error Handling**: Comprehensive error handling with clear messages
- **Rate Limiting**: Automatic rate limiting to respect API limits
- **Batch Operations**: Efficient bulk operations when possible

## MCP Servers

This power includes the following MCP servers:

### 1. Azure DevOps Core Server (`azure-devops-core`)
**Purpose**: Core work item operations
**Tools**:
- `create_user_story` - Create new user stories
- `create_task` - Create tasks (independent or linked)
- `get_work_items` - Retrieve work items with filtering
- `update_work_item` - Update existing work items
- `get_work_item` - Get specific work item by ID

### 2. Azure DevOps Auth Server (`azure-devops-auth`)
**Purpose**: Authentication and connection management
**Tools**:
- `authenticate` - Establish connection to Azure DevOps
- `get_auth_status` - Check current authentication status
- `disconnect` - Disconnect from Azure DevOps
- `test_connection` - Verify connection and permissions

### 3. Azure DevOps Search Server (`azure-devops-search`)
**Purpose**: Advanced search and filtering
**Tools**:
- `search_work_items` - Full-text search across work items
- `filter_by_assignment` - Filter tasks by assignee
- `filter_by_state` - Filter by work item state
- `get_my_tasks` - Get tasks assigned to current user

## Installation

### Prerequisites
- Kiro IDE with Powers support
- Azure DevOps organization access
- Personal Access Token with "Work Items (Read & Write)" permissions

### Install Power
1. Copy the power directory to your Kiro Powers location
2. Install dependencies: `npm install`
3. Build the power: `npm run build`
4. Activate in Kiro Powers panel

### Configure MCP Servers
Add to your Kiro MCP configuration:

```json
{
  "mcpServers": {
    "azure-devops-core": {
      "command": "node",
      "args": ["path/to/power/mcp-servers/azure-devops-core.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/yourorg",
        "AZURE_DEVOPS_PROJECT": "YourProject",
        "AZURE_DEVOPS_PAT": "your-personal-access-token"
      }
    },
    "azure-devops-auth": {
      "command": "node", 
      "args": ["path/to/power/mcp-servers/azure-devops-auth.js"]
    },
    "azure-devops-search": {
      "command": "node",
      "args": ["path/to/power/mcp-servers/azure-devops-search.js"]
    }
  }
}
```

## Usage

### Getting Started
1. Activate the Azure DevOps Power in Kiro
2. Use the authentication server to connect:
   ```
   Use azure-devops-auth server's authenticate tool with your credentials
   ```
3. Start managing work items through the core server tools

### Creating Work Items

**Create a User Story:**
```
Use azure-devops-core server's create_user_story tool:
- title: "As a user, I want to login to the application"
- description: "Implement user authentication system"
- storyPoints: 5
```

**Create a Task:**
```
Use azure-devops-core server's create_task tool:
- title: "Implement login form validation"
- description: "Add client-side validation for login form"
- remainingWork: 4
- parentId: 123 (optional - links to user story)
```

### Viewing and Searching

**Get All Work Items:**
```
Use azure-devops-core server's get_work_items tool with filters:
- type: "User Story" or "Task"
- state: "Active", "New", etc.
- assignedTo: specific user
```

**Search Work Items:**
```
Use azure-devops-search server's search_work_items tool:
- searchText: "authentication login"
```

### Updating Work Items

**Update Work Item:**
```
Use azure-devops-core server's update_work_item tool:
- id: 123
- updates: [
    { op: "replace", path: "/fields/System.State", value: "In Progress" },
    { op: "replace", path: "/fields/System.Title", value: "New Title" }
  ]
```

## Configuration

### Environment Variables
- `AZURE_DEVOPS_ORG_URL`: Your Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT`: Target project name  
- `AZURE_DEVOPS_PAT`: Personal Access Token

### Personal Access Token Setup
1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with "Work Items (Read & Write)" scope
3. Copy token and add to MCP server configuration

## Error Handling

The power includes comprehensive error handling:

- **Authentication Errors**: Clear messages for invalid credentials
- **Permission Errors**: Guidance on required PAT permissions
- **Network Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Specific field-level error messages
- **Rate Limiting**: Automatic throttling and retry logic

## Development

### Building from Source
```bash
cd power/
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev  # Watch mode compilation
```

### Project Structure
```
power/
├── src/                          # TypeScript source
├── mcp-servers/                  # MCP server implementations
│   ├── azure-devops-core.ts
│   ├── azure-devops-auth.ts
│   └── azure-devops-search.ts
├── dist/                         # Compiled JavaScript
├── POWER.md                      # This documentation
└── package.json                  # Power configuration
```

## Troubleshooting

### Common Issues

**MCP Server Connection Errors**
- Verify MCP server configuration in Kiro
- Check that all required environment variables are set
- Ensure the power is built (`npm run build`)

**Authentication Failures**
- Verify PAT token has correct permissions
- Check organization URL format
- Ensure project name is correct

**Tool Not Found Errors**
- Ensure MCP servers are running
- Check tool names match exactly
- Verify power is activated in Kiro

### Debug Mode
Enable debug logging by setting environment variable:
```bash
export DEBUG=azure-devops-power:*
```

## Steering Files

The power includes steering files for common workflows:

- `getting-started.md` - Initial setup and first work item creation
- `task-management.md` - Advanced task management workflows  
- `search-and-filter.md` - Effective work item discovery
- `troubleshooting.md` - Common issues and solutions

Access steering files through Kiro Powers interface.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review MCP server logs for detailed error information
3. Create an issue in the GitHub repository
4. Consult Kiro Powers documentation for general power usage