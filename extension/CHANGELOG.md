# Change Log

All notable changes to the Compass extension will be documented in this file.

## [1.0.0] - 2024-12-17

### 🎉 Initial Release

#### **Work Item Management**
- Complete CRUD operations for work items (User Stories, Tasks, Epics, Issues, Bugs)
- Hierarchical tree view with parent-child relationships
- Multi-project support with project switching
- Sprint filtering with "All Sprints" default option
- Real-time synchronization with Azure DevOps

#### **Scrum & Agile Features**
- Interactive scrum dashboard with real data
- Burndown charts with actual vs. ideal progress
- Team velocity tracking and trend analysis
- Sprint progress calculation with mixed effort support
- Work item matrix (Type vs. State) with effort totals
- Sprint metrics matrix with effort breakdown

#### **Test Management**
- Test plan creation and management
- Test case creation with detailed steps
- Test execution and result recording
- Batch operations for test plans and cases

#### **Developer Experience**
- Native VS Code tree view integration
- Command palette integration (20+ commands)
- Context menus for all work item types
- Status bar with connection status
- Comprehensive settings integration

#### **Advanced Features**
- MCP (Model Context Protocol) server for AI integration
- Batch creation operations (work items, test cases, plans)
- Configurable effort conversion (story points ↔ hours)
- Support for all Azure DevOps process templates
- Rate limiting and retry logic for API calls

#### **Authentication & Security**
- Personal Access Token (PAT) authentication
- Secure token storage in VS Code settings
- Auto-connection on startup
- Connection status monitoring

### 🔧 Technical Features
- TypeScript implementation with full type safety
- Comprehensive error handling and user feedback
- Extensible architecture for future enhancements
- Performance optimizations for large projects
- Detailed logging and diagnostics

### 📋 Supported Work Item Types
- **Basic Process**: Epic, Issue, Task
- **Agile Process**: Epic, Feature, User Story, Task, Bug
- **Scrum Process**: Epic, Feature, Product Backlog Item, Task, Bug
- **CMMI Process**: Epic, Feature, Requirement, Task, Bug

### 🎯 Supported Azure DevOps Features
- Work Items (all types)
- Iterations/Sprints
- Test Plans and Test Cases
- Project Management
- Classification Nodes
- Work Item Queries
- Batch Operations