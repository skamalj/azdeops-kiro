# Compass - Azure DevOps for Kiro IDE

[![Version](https://img.shields.io/badge/version-1.0.6-blue.svg)](https://marketplace.visualstudio.com/items?itemName=skamalj.compass)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Kiro IDE](https://img.shields.io/badge/Built%20for-Kiro%20IDE-blue.svg)](https://kiro.ai)

🧭 **Navigate Azure DevOps with natural language in Kiro IDE**

Compass transforms how you work with Azure DevOps by combining traditional UI with **AI-powered natural language commands**. Built specifically for Kiro IDE, it lets you manage work items, sprints, and projects using conversational AI while providing a comprehensive visual interface.

## 🤖 **Natural Language Azure DevOps with Kiro**

Talk to your Azure DevOps projects naturally:

### **Work Item Management**
```
"Create a user story called 'User Authentication' for the login team"
"List all pending work items in Sprint 5"  
"Update task #123 to mark it as completed"
"Show me all bugs assigned to John in the current sprint"
```

### **Sprint Planning**
```
"Create Sprint 6 from Jan 15 to Jan 29 for the backend team"
"What work items are in the current sprint?"
"Move work items 45, 67, and 89 to Sprint 7"
"Show me the sprint timeline and dates"
```

### **Project Insights**
```
"Switch to the PartsUnlimited project"
"What projects do I have access to?"
"Show me the scrum dashboard for current sprint"
"Create a test plan for the authentication feature"
```

### **Batch Operations**
```
"Create 5 user stories for the shopping cart feature"
"Generate test cases for the payment workflow"
"Update all tasks in Sprint 4 to mark them as done"
```

## 🎯 **Dual Experience: AI + Visual Interface**

### **🤖 AI-Powered (Kiro IDE)**
- **Natural language commands** for all Azure DevOps operations
- **Intelligent task completion** with context awareness
- **Conversational project management** 
- **Smart sprint planning** with date validation
- **Automated team assignments** and dashboard visibility

### **🖥️ Visual Interface (Kiro + VS Code)**
- **Interactive work item tree** with sprint filtering
- **Scrum dashboard** with burndown charts and velocity tracking
- **Context menus** for quick actions
- **Real-time synchronization** with Azure DevOps
- **Multi-project support** with seamless switching

## 🚀 **Quick Setup**

### **For Kiro IDE (Recommended)**

#### 1. Install Extension
Install Compass from the VS Code Marketplace or Kiro IDE extensions.

#### 2. Set Environment Variables
```bash
# Required for AI integration
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/yourorg"
export AZURE_DEVOPS_PROJECT="YourDefaultProject"  
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

#### 3. Install Kiro Power (Optional - Enhanced AI)
```
1. Open Kiro IDE
2. Install Power from: https://github.com/skamalj/azdeops-kiro/tree/main/power
3. Enjoy enhanced AI capabilities with work items and sprints
```

#### 4. Start Using Natural Language
```
"List work items in azdevops project"
"Create a sprint called 'Q1 Release' from Feb 1 to Feb 14 for the dev team"
"Show me all pending tasks"
```

### **For VS Code**

#### 1. Install Extension
Install Compass from the VS Code Marketplace.

#### 2. Configure Settings
```json
{
  "azureDevOps.organizationUrl": "https://dev.azure.com/yourorg",
  "azureDevOps.projectName": "YourProject",
  "azureDevOps.personalAccessToken": "your-pat-token"
}
```

#### 3. Connect
```
Ctrl+Shift+P → "Compass: Connect to Organization"
```

## 🔑 **Personal Access Token Setup**

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with these permissions:
   - **Work Items**: Read & Write
   - **Project and Team**: Read
   - **Test Management**: Read & Write (optional)
3. Copy the token and use in environment variable or settings

## ✨ **Key Features**

### **🎯 Sprint Management**
- Create sprints with automatic team assignment
- View sprint timelines with start/end dates
- Assign work items to sprints conversationally
- Dashboard visibility for all team sprints

### **📋 Work Item Operations**
- Full CRUD operations via natural language
- Hierarchical relationships (epics → stories → tasks)
- Batch creation and updates
- Real-time synchronization

### **📊 Analytics & Reporting**
- Interactive scrum dashboard
- Burndown charts with actual vs. ideal progress
- Team velocity tracking
- Work item distribution analysis

### **🧪 Test Management**
- Test plan creation and management
- Test case authoring with detailed steps
- Test execution and result recording
- Batch test operations

## 🔧 **Advanced Configuration**

### **MCP Server Settings (Kiro IDE)**
```bash
# Optional: Customize MCP server port
export MCP_SERVER_PORT=3001

# Optional: Enable debug logging
export FASTMCP_LOG_LEVEL=DEBUG
```

### **Extension Settings (VS Code)**
```json
{
  "azureDevOps.autoSync": true,
  "azureDevOps.syncInterval": 300,
  "azureDevOps.effortConversion.storyPointsToHours": 8,
  "azureDevOps.mcpServer.enabled": true,
  "azureDevOps.mcpServer.port": 3001
}
```

## 🎯 **Why Compass?**

- **🤖 AI-First**: Natural language interface for Azure DevOps
- **🚀 Productivity**: Reduce clicks, increase conversation
- **🎯 Kiro Optimized**: Built specifically for Kiro IDE workflows
- **🔄 Dual Mode**: AI + traditional UI for maximum flexibility
- **⚡ Real-time**: Instant synchronization with Azure DevOps
- **🎨 Modern**: Clean, intuitive interface design

## 📝 **License**

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for the Kiro IDE community**

