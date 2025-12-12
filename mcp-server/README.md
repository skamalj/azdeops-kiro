# Azure DevOps MCP Server

This is a standalone MCP (Model Context Protocol) server for Azure DevOps integration. It's used by the Kiro Power but can also be run independently.

## Features

- Create and manage user stories and tasks
- Query work items with filtering
- Update work item states and fields
- Support for parent-child relationships

## Usage

### Environment Variables
Set these environment variables:
- `AZURE_DEVOPS_ORG_URL` - Your Azure DevOps organization URL
- `AZURE_DEVOPS_PROJECT` - Your project name
- `AZURE_DEVOPS_PAT` - Your Personal Access Token

### Running the Server
```bash
npm install
npx tsx index.ts
```

### Available Tools
- `create_user_story` - Create new user stories
- `create_task` - Create tasks (independent or linked)
- `get_work_items` - Query work items with filters
- `update_work_item` - Update existing work items
- `get_work_item` - Get specific work item details

## Integration

This server is automatically used by the Azure DevOps Kiro Power. The power references this server via GitHub URL, so no local installation is required for Kiro users.