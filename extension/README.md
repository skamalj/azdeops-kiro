# Compass

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=skamalj.compass)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Kiro IDE](https://img.shields.io/badge/Built%20for-Kiro%20IDE-blue.svg)](https://kiro.ai)

🧭 **Navigate your Azure DevOps projects with precision**

Compass is a comprehensive extension **primarily built for Kiro IDE** with full VS Code compatibility. It brings Azure DevOps work item management, sprint planning, and scrum dashboard directly into your development environment. Like a navigator's compass, it helps you find direction in complex projects and keeps your team on course.

## 🎯 **Built for Kiro IDE**

This extension is **optimized for Kiro IDE** and includes:
- **Kiro Power integration** for AI-powered workflows
- **MCP (Model Context Protocol) server** for intelligent task completion
- **Enhanced Kiro-specific features** and integrations

**Also works with VS Code** - All core features are fully compatible with Visual Studio Code.

## 🚀 Features

### **Work Item Management**
- ✅ **Complete CRUD Operations**: Create, read, update, and delete work items
- ✅ **Multi-Project Support**: Switch between Azure DevOps projects seamlessly  
- ✅ **Hierarchical View**: Parent-child relationships with expandable tree structure
- ✅ **Sprint Filtering**: Filter work items by sprint with "All Sprints" default
- ✅ **Real-time Sync**: Immediate updates with Azure DevOps backend

### **Scrum & Agile Tools**
- ✅ **Sprint Dashboard**: Interactive dashboard with real sprint data
- ✅ **Burndown Charts**: Visual progress tracking with actual vs. ideal burndown
- ✅ **Team Velocity**: Historical velocity tracking and trend analysis
- ✅ **Mixed Effort Support**: Handles story points, hours, and count-based metrics
- ✅ **Work Item Matrix**: Type vs. State analysis with effort totals

### **Test Management** (Not tested yet)
- ✅ **Test Plans**: Create and manage test plans
- ✅ **Test Cases**: Create test cases with detailed steps
- ✅ **Test Execution**: Execute tests and record results
- ✅ **Batch Operations**: Bulk creation of test cases and plans

### **Developer Experience**
- ✅ **VS Code Integration**: Native tree view in Activity Bar
- ✅ **Command Palette**: Full command integration (Ctrl+Shift+P)
- ✅ **Context Menus**: Right-click actions on all items
- ✅ **Status Bar**: Connection status and active project display
- ✅ **Settings Integration**: Configuration through VS Code settings

### **Advanced Features**
- ✅ **MCP Server**: Model Context Protocol server for AI integration
- ✅ **Batch Operations**: Bulk creation of work items, test cases, and plans
- ✅ **Effort Conversion**: Configurable ratios between story points and hours
- ✅ **Process Template Support**: Works with Basic, Agile, Scrum, and CMMI templates

## 📦 Installation

### 🎯 **For Kiro IDE (Recommended)**

#### Option 1: Install Kiro Power (AI Integration)
```
1. Install Extension
2. Open Kiro IDE
3. Install Power from GitHub URL:
   https://github.com/skamalj/azdeops-kiro/tree/main/power
4. Automatic AI integration with work items and sprints
```

### 💻 **For VS Code**

#### MCP Integration
1. MCP server although will start, it is not tested with any copilot. Server starts in stdio mode.

## 🚀 Quick Start

### 1. Connect to Azure DevOps
```
Ctrl+Shift+P → "Compass: Connect to Organization"
```
- Enter your Azure DevOps organization URL
- Provide your Personal Access Token (PAT)
- Select your project

### 2. View Work Items
- Open the Compass panel in the Activity Bar
- Browse work items by project and sprint
- Use the sprint filter to focus on specific iterations

### 3. Create Work Items
```
Ctrl+Shift+P → "Azure DevOps: Create User Story"
Ctrl+Shift+P → "Azure DevOps: Create Task"
```

### 4. Open Scrum Dashboard
```
Ctrl+Shift+P → "Azure DevOps: Show Scrum Dashboard"
```

## ⚙️ Configuration

### 🎯 **Kiro IDE Configuration**

#### Kiro Power Setup
If using the Kiro Power, it includes automatic MCP server configuration:
```
GitHub URL: https://github.com/skamalj/azdeops-kiro/tree/main/power
```

#### MCP Server Environment Variables
**Important**: The MCP server requires environment variables (settings integration not yet available):

```bash
# Required environment variables
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/yourorg"
export AZURE_DEVOPS_PROJECT="YourProject"  
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

### 💻 **VS Code Configuration**

Configure through VS Code settings:

```json
{
  "azureDevOps.organizationUrl": "https://dev.azure.com/yourorg",
  "azureDevOps.projectName": "YourProject",
  "azureDevOps.personalAccessToken": "your-pat-token",
  "azureDevOps.effortConversion.storyPointsToHours": 8,
  "azureDevOps.effortConversion.preferredUnit": "auto"
}
```

> **Note**: MCP server functionality requires environment variables even in VS Code at the moment.

