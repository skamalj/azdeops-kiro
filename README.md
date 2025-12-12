# Azure DevOps Integration for Kiro

A comprehensive Azure DevOps integration solution for Kiro IDE, providing seamless work item management and development workflow automation.

## Project Structure

This repository contains two complementary Azure DevOps integration solutions:

### 🔌 Extension (`/extension/`)
A native VS Code/Kiro extension that provides:
- **Work Item Management**: Create, read, update user stories and tasks
- **Tree View Integration**: Hierarchical display in VS Code Activity Bar
- **Command Palette**: Full command integration with VS Code
- **Settings Integration**: Configuration via VS Code settings
- **Real-time Sync**: Immediate updates with Azure DevOps

**Status**: ✅ Complete and functional
**Installation**: Install the `.vsix` file in VS Code/Kiro

### ⚡ Power (`/power/`)
A Kiro Power that provides the same functionality through MCP servers:
- **MCP Server Integration**: Azure DevOps operations via Model Context Protocol
- **Kiro Powers Framework**: Native Kiro Powers experience
- **Same Commands**: Create stories, tasks, updates, etc.
- **Distributed Architecture**: References external MCP server

**Status**: ✅ Complete and functional

### 🖥️ MCP Server (`/mcp-server/`)
Standalone MCP server for Azure DevOps integration:
- **Independent Server**: Can be used with any MCP-compatible client
- **Core Functionality**: Work item CRUD operations
- **GitHub Integration**: Referenced directly by the Kiro Power
- **TypeScript**: Modern TypeScript implementation

**Status**: ✅ Complete and functional

### 📚 Shared (`/shared/`)
Common utilities and types shared between extension and power:
- **TypeScript Types**: Shared interfaces and data models
- **Utility Functions**: Common helper functions
- **Constants**: Shared configuration and constants

## Features

### Core Functionality
- ✅ **Authentication**: Personal Access Token (PAT) support
- ✅ **User Stories**: Create, view, edit user stories with story points
- ✅ **Tasks**: Create independent tasks or link to parent stories
- ✅ **Hierarchical Structure**: Support for parent-child work item relationships
- ✅ **Real-time Updates**: Immediate synchronization with Azure DevOps
- ✅ **Error Handling**: Comprehensive error handling with user-friendly messages

### Advanced Features (Extension)
- ✅ **Tree View**: Hierarchical display of work items
- ✅ **Context Menus**: Right-click actions on work items
- ✅ **Quick Pick**: Native VS Code selection interfaces
- ✅ **Status Bar**: Connection status and active task display
- ✅ **Settings UI**: Configuration through VS Code settings

### Advanced Features (Power - Planned)
- 🚧 **MCP Integration**: Native Kiro Powers experience
- 🚧 **Distributed Servers**: Separate MCP servers for different operations
- 🚧 **Power Documentation**: Comprehensive POWER.md documentation
- 🚧 **Steering Files**: Guided workflows and usage patterns

## Getting Started

### Extension Installation
1. Navigate to `/extension/`
2. Install dependencies: `npm install`
3. Build: `npm run compile`
4. Package: `npx vsce package`
5. Install the generated `.vsix` file in VS Code/Kiro

### Power Installation (Coming Soon)
1. Navigate to `/power/`
2. Follow Kiro Powers installation guide
3. Configure MCP servers as needed

## Configuration

### Azure DevOps Setup
1. Create a Personal Access Token (PAT) in Azure DevOps
2. Ensure PAT has "Work Items (Read & Write)" permissions
3. Configure organization URL and project name

### Extension Configuration
Configure via VS Code Settings:
- `azureDevOps.organizationUrl`: Your Azure DevOps organization URL
- `azureDevOps.projectName`: Target project name
- `azureDevOps.personalAccessToken`: Your PAT token

### Power Configuration (Coming Soon)
Configure via Kiro Powers settings and MCP server configuration.

## Development

### Extension Development
```bash
cd extension/
npm install
npm run compile
npm run test
```

### Power Development (Coming Soon)
```bash
cd power/
npm install
npm run build
npm run test
```

## Testing

The project includes comprehensive testing:
- **Property-based Tests**: 13 tests with 100+ iterations each
- **Unit Tests**: Comprehensive coverage of all components
- **Integration Tests**: End-to-end workflow testing

Run tests:
```bash
# Extension tests
cd extension/
npm test

# Power tests (coming soon)
cd power/
npm test
```

## Architecture

### Extension Architecture
- **Authentication Layer**: PAT authentication with secure storage
- **API Client**: Azure DevOps REST API with rate limiting
- **UI Layer**: Native VS Code integration
- **Command Layer**: VS Code command palette integration

### Power Architecture (Planned)
- **MCP Servers**: Distributed servers for different operations
- **Power Framework**: Native Kiro Powers integration
- **Shared Services**: Common authentication and API services

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the documentation in each component's directory
2. Review the specification documents in `.kiro/specs/`
3. Create an issue in the GitHub repository

---

**Note**: This project provides two different approaches to Azure DevOps integration for Kiro IDE. Choose the extension for immediate VS Code compatibility or the power for native Kiro Powers experience.