# Compass

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=skamalj.compass)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

🧭 **Navigate your Azure DevOps projects with precision**

Compass is a comprehensive VS Code extension that brings Azure DevOps work item management, sprint planning, and scrum dashboard directly into your development environment. Like a navigator's compass, it helps you find direction in complex projects and keeps your team on course.

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

### **Test Management**
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

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Compass"
4. Click Install

### From VSIX Package
1. Download the latest `.vsix` file from releases
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Select the VSIX file and install

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

Configure the extension through VS Code settings:

```json
{
  "azureDevOps.organizationUrl": "https://dev.azure.com/yourorg",
  "azureDevOps.projectName": "YourProject",
  "azureDevOps.personalAccessToken": "your-pat-token",
  "azureDevOps.effortConversion.storyPointsToHours": 8,
  "azureDevOps.effortConversion.preferredUnit": "auto"
}
```

## 🎯 Usage Examples

### Sprint Planning
1. Use the sprint filter to view work items by iteration
2. Open the scrum dashboard to see sprint progress
3. Create new work items and assign to sprints

### Test Management
1. Create test plans for your features
2. Add test cases with detailed steps
3. Execute tests and record results

### Team Collaboration
1. View work item assignments by team member
2. Track team velocity across sprints
3. Monitor burndown progress in real-time
2. Compile: `npm run compile`
3. Package: `npx vsce package`
4. Install the generated VSIX file

## Configuration

Configure via VS Code Settings (`Ctrl+,` → search "Azure DevOps"):

- **Organization URL**: `https://dev.azure.com/yourorg` or `https://yourorg.visualstudio.com`
- **Project Name**: Your Azure DevOps project name
- **Personal Access Token**: PAT with "Work Items (Read & Write)" permissions

### Creating a Personal Access Token
1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with "Work Items (Read & Write)" scope
3. Copy the token and paste it in VS Code settings

## Usage

### Getting Started
1. Configure your Azure DevOps settings (see Configuration above)
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run `Azure DevOps: Connect to Organization`
4. View work items in the Azure DevOps Activity Bar panel

### Available Commands
Access via Command Palette (`Ctrl+Shift+P` → "Azure DevOps:"):

- **Connect to Organization** - Establish connection to Azure DevOps
- **Disconnect** - Disconnect from Azure DevOps
- **Create User Story** - Create new user story with story points
- **Create Task** - Create task (independent or linked to story)
- **Select Active Task** - Choose a task to work on
- **Show My Tasks** - View tasks assigned to you
- **Search Work Items** - Search across all work items
- **Sync Work Items** - Manual refresh from Azure DevOps
- **Configure Personal Access Token** - Set up authentication
- **Test: Create Sample Story** - Create a test story for verification

### Tree View Operations
In the Azure DevOps Activity Bar panel:

- **Single-click**: View work item details
- **Right-click**: Context menu with actions:
  - Start Task (changes state to "In Progress")
  - Edit Task (modify title and other fields)
  - View Details (full information dialog)

### Task Creation Workflow
1. Run `Azure DevOps: Create Task`
2. Enter task title and description
3. Choose: "Create independent task" or "Link to existing user story"
4. If linking: Select parent story from dropdown
5. Task is created and appears in tree view

## Architecture

### Core Components
- **AuthenticationService**: Handles PAT authentication and token management
- **AzureDevOpsApiClient**: REST API client with rate limiting and error handling
- **AzureDevOpsExplorerProvider**: Tree view data provider for work items
- **ConnectionProvider**: Tree view for connection status
- **CommandManager**: Handles all VS Code commands
- **StatusBarManager**: Status bar integration

### Data Flow
1. User configures settings or uses command palette
2. AuthenticationService validates credentials
3. AzureDevOpsApiClient makes REST API calls
4. Tree view providers update UI
5. User receives feedback via notifications

## Testing

Run the comprehensive test suite:

```bash
npm test
```

### Test Coverage
- **13 Property-based tests** with 100+ iterations each
- **Authentication flow testing**
- **API client testing with mock responses**
- **Work item CRUD operations**
- **Error handling scenarios**

## Development

### Setup
```bash
npm install
npm run compile
```

### Available Scripts
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm test` - Run all tests
- `npm run lint` - Run ESLint
- `npx vsce package` - Create VSIX package

### Project Structure
```
extension/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── services/                 # Core services
│   │   ├── AuthenticationService.ts
│   │   └── AzureDevOpsApiClient.ts
│   ├── ui/                       # UI components
│   │   ├── providers/            # Tree view providers
│   │   └── managers/             # Command and status managers
│   ├── interfaces/               # TypeScript interfaces
│   └── types/                    # Type definitions
├── tests/                        # Test files
├── dist/                         # Compiled JavaScript
└── package.json                  # Extension manifest
```

## Troubleshooting

### Common Issues

**"Command not found" errors**
- Ensure extension is properly installed and activated
- Check VS Code Developer Console for activation errors

**Authentication failures**
- Verify PAT token has correct permissions
- Check organization URL format
- Ensure project name is correct

**"No data provider registered" errors**
- Restart VS Code after installation
- Check that extension activated successfully

**API rate limiting**
- Extension includes automatic rate limiting
- Wait for rate limit reset if you see delays

### Debug Mode
1. Open VS Code Developer Tools (`Help` → `Toggle Developer Tools`)
2. Check Console tab for detailed error messages
3. Look for Azure DevOps extension logs

### Getting Help
1. Check this README and configuration
2. Review error messages in VS Code notifications
3. Use `Azure DevOps: Run Diagnostics` command for system status
4. Create an issue in the GitHub repository

## License

MIT License - see LICENSE file for details.