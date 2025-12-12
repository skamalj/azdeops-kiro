# Getting Started with Azure DevOps Power

This guide will help you get started with the Azure DevOps Power for Kiro.

## Installation

1. Install the power from GitHub: `skamalj/azdeops-kiro/power`
2. The power automatically configures the MCP server
3. Set environment variables (see below)
4. Restart Kiro

## Prerequisites

Before using this power, you need:

1. **Azure DevOps Organization**: Access to an Azure DevOps organization
2. **Personal Access Token (PAT)**: A PAT with "Work Items (Read & Write)" permissions
3. **Project Access**: Access to at least one Azure DevOps project
4. **Node.js**: For running the MCP server

## Environment Setup

The Azure DevOps Power requires three environment variables:

```bash
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/yourorg"
export AZURE_DEVOPS_PROJECT="YourProjectName"
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

### Getting a Personal Access Token

1. Go to your Azure DevOps organization
2. Click on your profile picture → Personal Access Tokens
3. Create a new token with "Work Items (Read & Write)" scope
4. Copy the token (you won't see it again!)

## Basic Usage

### Creating Work Items

**Create a User Story:**
```
Create a user story titled "As a user, I want to login to the system" with 5 story points
```

**Create a Task:**
```
Create a task titled "Implement login API endpoint" with 8 hours remaining work
```

**Create a Task under a User Story:**
```
Create a task titled "Write unit tests for login" under user story #123
```

### Viewing Work Items

**Get all work items:**
```
Show me all work items
```

**Filter by type:**
```
Show me all user stories
```

**Filter by state:**
```
Show me all active tasks
```

### Updating Work Items

**Update a work item:**
```
Update work item #123 to set the state to "Done"
```

## Common Workflows

### 1. Sprint Planning
1. Create user stories for the sprint
2. Break down stories into tasks
3. Assign story points and remaining work estimates

### 2. Daily Development
1. Check assigned tasks
2. Update task progress
3. Create new tasks as needed

### 3. Sprint Review
1. Update work item states
2. Review completed work
3. Plan next sprint items

## Tips

- Use descriptive titles for better organization
- Set story points for user stories to help with planning
- Estimate remaining work for tasks to track progress
- Use tags to categorize work items
- Link tasks to user stories for better hierarchy