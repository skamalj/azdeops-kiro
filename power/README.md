# Azure DevOps Power for Kiro

A comprehensive Kiro Power that provides Azure DevOps work item management through MCP (Model Context Protocol) servers.

## Features

- **Work Item Management**: Create, read, update user stories and tasks
- **Test Case Management**: Create and execute test cases with test plans
- **Multi-Project Support**: Switch between different Azure DevOps projects
- **Scrum Dashboard**: Get sprint metrics and team velocity analytics
- **Natural Language Interface**: Conversational work item management

## Installation

### From GitHub
1. In Kiro, go to Powers panel
2. Click "Install from GitHub"
3. Enter repository: `skamalj/azdeops-kiro`
4. Specify path: `power`
5. Branch: `main`

### Manual Installation
1. Clone the repository
2. Navigate to the `power/` directory
3. Run `npm install && npm run build`
4. Add to Kiro Powers from this directory

## Configuration

Set these environment variables:
- `AZURE_DEVOPS_ORG_URL`: Your Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT`: Your project name
- `AZURE_DEVOPS_PAT`: Your Personal Access Token

## Usage

Once installed and configured, you can use natural language commands:

- "Show me all work items from Azure DevOps"
- "Create a user story: As a user, I want to login"
- "List all projects in my organization"
- "Create a test case for login functionality"
- "Show me scrum metrics for the current project"

## MCP Tools

This power provides 10 MCP tools:
- `create_user_story`
- `create_task`
- `get_work_items`
- `update_work_item`
- `get_work_item`
- `create_test_case`
- `create_test_plan`
- `get_projects`
- `switch_project`
- `get_scrum_metrics`

## License

MIT License