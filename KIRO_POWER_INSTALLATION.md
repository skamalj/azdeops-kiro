# Azure DevOps Kiro Power - Installation Guide

## 🎯 **Quick Installation Steps**

### **1. Install the Power**

#### **Option A: Local Installation**
1. Open Kiro IDE
2. Go to the Powers panel (usually in the sidebar)
3. Click "Add Custom Power" or "Install from Folder"
4. Navigate to and select the `power/` directory from this project
5. Kiro will automatically detect and install the power

#### **Option B: Command Palette Installation**
1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Kiro: Install Power from Folder"
3. Select the `power/` directory
4. Confirm installation

### **2. Configure MCP Server**

After installing the power, you need to configure the MCP server:

#### **Method 1: Using Kiro Settings UI**
1. Open Kiro Settings
2. Navigate to "MCP Servers" or "Powers Configuration"
3. Add a new MCP server with these settings:
   - **Name**: `azure-devops-core`
   - **Command**: `node`
   - **Args**: `["path/to/power/dist/index.js", "azure-devops-core"]`
   - **Environment Variables**: (see below)

#### **Method 2: Manual Configuration File**
Create or edit your MCP configuration file at `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "azure-devops-core": {
      "command": "node",
      "args": ["./power/dist/index.js", "azure-devops-core"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/yourorganization",
        "AZURE_DEVOPS_PROJECT": "YourProjectName",
        "AZURE_DEVOPS_PAT": "your-personal-access-token-here"
      },
      "disabled": false,
      "autoApprove": [
        "create_user_story",
        "create_task",
        "get_work_items",
        "update_work_item",
        "get_work_item",
        "create_test_case",
        "create_test_plan",
        "get_projects",
        "switch_project",
        "get_scrum_metrics"
      ]
    }
  }
}
```

### **3. Set Up Azure DevOps Credentials**

You need to configure your Azure DevOps credentials as environment variables:

#### **Required Environment Variables:**
- `AZURE_DEVOPS_ORG_URL`: Your Azure DevOps organization URL
  - Example: `https://dev.azure.com/yourcompany`
- `AZURE_DEVOPS_PROJECT`: Your project name
  - Example: `MyProject`
- `AZURE_DEVOPS_PAT`: Your Personal Access Token
  - Example: `abcdef1234567890...`

#### **How to Get a Personal Access Token:**
1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Click "New Token"
3. Set these scopes:
   - **Work Items**: Read & Write
   - **Test Management**: Read & Write (for test cases)
   - **Project and Team**: Read (for multi-project support)
4. Copy the generated token

### **4. Verify Installation**

After configuration, verify the power is working:

1. **Check MCP Server Status**:
   - Open Kiro's MCP Server panel
   - Look for "azure-devops-core" server
   - Status should be "Connected" or "Running"

2. **Test Basic Functionality**:
   - Try: "Show me all work items from Azure DevOps"
   - Try: "Create a user story called 'Test Story'"
   - Try: "List all projects in my organization"

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **MCP Server Not Starting**
- Check that Node.js is installed and accessible
- Verify the path to `power/dist/index.js` is correct
- Check environment variables are set correctly

#### **Authentication Errors**
- Verify your PAT token has correct permissions
- Check organization URL format (should include https://)
- Ensure project name matches exactly (case-sensitive)

#### **Permission Errors**
- Verify PAT token has "Work Items (Read & Write)" permissions
- For test cases: Add "Test Management (Read & Write)" permissions
- For projects: Add "Project and Team (Read)" permissions

### **Debug Mode**
Enable debug logging by adding to environment variables:
```json
"env": {
  "DEBUG": "azure-devops-power:*",
  "AZURE_DEVOPS_ORG_URL": "...",
  "AZURE_DEVOPS_PROJECT": "...",
  "AZURE_DEVOPS_PAT": "..."
}
```

## 🎯 **Usage Examples**

Once installed, you can use natural language commands:

### **Work Item Management**
- "Create a user story: As a user, I want to login to the system"
- "Show me all active tasks"
- "Update work item 123 to set state to In Progress"
- "Get details for work item 456"

### **Test Case Management**
- "Create a test case for login functionality with 3 steps"
- "Create a test plan called 'Sprint 1 Testing'"
- "Show me all test cases in the current project"

### **Project Management**
- "List all projects I have access to"
- "Switch to project 'MyOtherProject'"
- "Show me scrum metrics for the current project"

### **Advanced Queries**
- "Show me all user stories assigned to John Doe"
- "Get all tasks that are in progress"
- "Create a task linked to user story 789"

## 📊 **Available Tools**

The power provides these MCP tools:

1. **create_user_story** - Create new user stories
2. **create_task** - Create tasks (independent or linked)
3. **get_work_items** - Retrieve work items with filtering
4. **update_work_item** - Update existing work items
5. **get_work_item** - Get specific work item details
6. **create_test_case** - Create test cases with steps
7. **create_test_plan** - Create test plans
8. **get_projects** - List accessible projects
9. **switch_project** - Change project context
10. **get_scrum_metrics** - Get sprint analytics

## 🎉 **You're Ready!**

Once configured, you can start managing Azure DevOps work items through natural language conversations in Kiro!

Try saying: "Show me all work items from Azure DevOps" to get started.