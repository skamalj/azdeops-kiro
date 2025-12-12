# Azure DevOps Integration Extension

A VS Code/Kiro extension that provides seamless Azure DevOps work item management directly within the IDE.

## Features

### ✅ Implemented
- **Authentication**: Personal Access Token (PAT) support with VS Code settings integration
- **User Stories**: Create, view, edit user stories with story points selection
- **Tasks**: Create independent tasks or link to parent user stories
- **Tree View**: Hierarchical display in VS Code Activity Bar
- **Command Palette**: Full integration with VS Code commands (Ctrl+Shift+P)
- **Context Menus**: Right-click actions on work items
- **Real-time Sync**: Immediate updates with Azure DevOps
- **Error Handling**: Comprehensive error handling with user-friendly messages

### 🚧 Future Enhancements
- **Task Intelligence**: Automatic task analysis and completion
- **Offline Sync**: Local caching and offline operation queuing
- **Advanced Scrum**: Sprint management and workflow automation

## Installation

### From VSIX Package
1. Locate the `azure-devops-integration-1.0.0.vsix` file
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Select the VSIX file and install

### From Source
1. Install dependencies: `npm install`
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