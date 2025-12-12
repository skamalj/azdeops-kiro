---
name: "Azure DevOps Power"
description: "Comprehensive Azure DevOps work item management through MCP servers"
version: "1.0.0"
author: "Azure DevOps Integration Team"
keywords: ["azure-devops", "work-items", "scrum", "project-management", "test-cases"]
mcpServers:
  - name: "azure-devops-core"
    description: "Core Azure DevOps work item management server"
    command: "node"
    args: ["dist/index.js", "azure-devops-core"]
---

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

### Test Case Management
- **Create Test Cases**: Define test scenarios with detailed steps and expected results
- **Test Plan Organization**: Create and manage test plans for structured testing
- **Test Execution**: Record test results and track testing progress
- **Priority Management**: Set test case priorities (Critical, High, Medium, Low)

### Multi-Project Support
- **Project Discovery**: List all accessible projects in your organization
- **Project Switching**: Switch between different Azure DevOps projects seamlessly
- **Context Management**: Maintain project-specific work item contexts
- **Cross-Project Operations**: Work with multiple projects in the same session

### Scrum Dashboard
- **Sprint Progress**: Track story points and task completion in current sprint
- **Team Velocity**: Monitor team velocity trends and averages
- **Burndown Analytics**: View sprint burndown data and progress tracking
- **Work Distribution**: Analyze work items by type, state, and assignee

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

### Azure DevOps Core Server (`azure-devops-core`)
**Purpose**: Complete Azure DevOps work item management with test case support and project management
**Tools**:
- `create_user_story` - Create new user stories with story points
- `create_task` - Create tasks (independent or linked to user stories)
- `get_work_items` - Retrieve work items with advanced filtering
- `update_work_item` - Update existing work items with patch operations
- `get_work_item` - Get detailed information about specific work items
- `create_test_case` - Create test cases with steps and expected results
- `create_test_plan` - Create test plans for organizing test cases
- `get_projects` - List accessible projects in the organization
- `switch_project` - Switch between different Azure DevOps projects
- `get_scrum_metrics` - Get sprint progress and team velocity metrics

**Environment Variables Required**:
- `AZURE_DEVOPS_ORG_URL` - Your Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT` - Target project name
- `AZURE_DEVOPS_PAT` - Personal Access Token with Work Items permissions

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

### Configure MCP Server
Add to your Kiro MCP configuration:

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

## Usage

### Getting Started
1. Activate the Azure DevOps Power in Kiro
2. Configure environment variables with your Azure DevOps credentials
3. Start managing work items through natural language commands

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

### Test Case Management

**Create a Test Case:**
```
Use azure-devops-core server's create_test_case tool:
- title: "Verify user login functionality"
- description: "Test user authentication with valid credentials"
- steps: [
    { stepNumber: 1, action: "Navigate to login page", expectedResult: "Login form is displayed" },
    { stepNumber: 2, action: "Enter valid username and password", expectedResult: "Credentials are accepted" },
    { stepNumber: 3, action: "Click login button", expectedResult: "User is redirected to dashboard" }
  ]
- priority: "High"
```

**Create a Test Plan:**
```
Use azure-devops-core server's create_test_plan tool:
- name: "Sprint 1 Testing"
- description: "Test plan for sprint 1 features"
- areaPath: "MyProject\\Web"
- iterationPath: "MyProject\\Sprint 1"
- projectId: "your-project-id"
```

### Project Management

**List Available Projects:**
```
Use azure-devops-core server's get_projects tool to see all accessible projects
```

**Switch to Different Project:**
```
Use azure-devops-core server's switch_project tool:
- projectId: "proj-123"
- projectName: "My Other Project"
```

### Scrum Dashboard

**Get Sprint Metrics:**
```
Use azure-devops-core server's get_scrum_metrics tool to view:
- Sprint progress and completion percentage
- Team velocity trends and averages
- Work item distribution by type, state, and assignee
- Burndown data and remaining work
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
│   ├── mcp-servers/             # MCP server implementations
│   │   └── azure-devops-core.ts
│   ├── services/                # API client services
│   │   └── AzureDevOpsApiClient.ts
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts
│   └── index.ts                 # Main entry point
├── steering/                     # Workflow guides
│   ├── getting-started.md
│   └── advanced-usage.md
├── dist/                         # Compiled JavaScript
├── POWER.md                      # This documentation
├── package.json                  # Power configuration
└── tsconfig.json                 # TypeScript configuration
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