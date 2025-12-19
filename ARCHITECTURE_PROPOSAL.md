# Multi-Backend Architecture Proposal

## Current Issues
- Tightly coupled to Azure DevOps
- Hardcoded work item types and schemas
- No abstraction for different project management tools

## Proposed Architecture

### 1. Common Interface Layer
```typescript
// Common work item interface
interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: WorkItemType;
  state: WorkItemState;
  assignedTo?: string;
  effort?: number; // Generic effort (story points, hours, etc.)
  tags?: string[];
  createdDate: Date;
  updatedDate: Date;
  parentId?: string;
  children?: WorkItem[];
}

// Generic work item types
enum WorkItemType {
  EPIC = 'epic',
  STORY = 'story', 
  TASK = 'task',
  BUG = 'bug',
  FEATURE = 'feature'
}

// Generic states
enum WorkItemState {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress', 
  DONE = 'done',
  BLOCKED = 'blocked'
}
```

### 2. Backend Provider Interface
```typescript
interface ProjectManagementProvider {
  // Authentication
  authenticate(config: ProviderConfig): Promise<void>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  switchProject(projectId: string): Promise<void>;
  
  // Work Items
  getWorkItems(query?: WorkItemQuery): Promise<WorkItem[]>;
  getWorkItem(id: string): Promise<WorkItem>;
  createWorkItem(item: CreateWorkItemRequest): Promise<WorkItem>;
  updateWorkItem(id: string, updates: UpdateWorkItemRequest): Promise<WorkItem>;
  
  // Sprints/Iterations
  getSprints(): Promise<Sprint[]>;
  getSprintWorkItems(sprintId: string): Promise<WorkItem[]>;
  assignWorkItemsToSprint(workItemIds: string[], sprintId: string): Promise<void>;
  
  // Provider-specific capabilities
  getCapabilities(): ProviderCapabilities;
}
```

### 3. Provider Implementations

#### Azure DevOps Provider
```typescript
class AzureDevOpsProvider implements ProjectManagementProvider {
  private mapAzureWorkItemType(azureType: string): WorkItemType {
    switch (azureType) {
      case 'User Story': return WorkItemType.STORY;
      case 'Task': return WorkItemType.TASK;
      case 'Epic': return WorkItemType.EPIC;
      case 'Bug': return WorkItemType.BUG;
      default: return WorkItemType.TASK;
    }
  }
  
  private mapAzureState(azureState: string): WorkItemState {
    switch (azureState) {
      case 'New': case 'To Do': return WorkItemState.TODO;
      case 'Active': case 'In Progress': return WorkItemState.IN_PROGRESS;
      case 'Done': case 'Closed': return WorkItemState.DONE;
      case 'Blocked': return WorkItemState.BLOCKED;
      default: return WorkItemState.TODO;
    }
  }
  
  async getWorkItems(query?: WorkItemQuery): Promise<WorkItem[]> {
    // Azure DevOps specific implementation
    const azureItems = await this.azureClient.getWorkItems(query);
    return azureItems.map(item => this.mapToCommonWorkItem(item));
  }
}
```

#### Jira Provider
```typescript
class JiraProvider implements ProjectManagementProvider {
  private mapJiraIssueType(jiraType: string): WorkItemType {
    switch (jiraType.toLowerCase()) {
      case 'story': return WorkItemType.STORY;
      case 'task': return WorkItemType.TASK;
      case 'epic': return WorkItemType.EPIC;
      case 'bug': return WorkItemType.BUG;
      default: return WorkItemType.TASK;
    }
  }
  
  async getWorkItems(query?: WorkItemQuery): Promise<WorkItem[]> {
    // Jira specific implementation
    const jiraIssues = await this.jiraClient.searchIssues(query);
    return jiraIssues.map(issue => this.mapToCommonWorkItem(issue));
  }
}
```

#### GitHub Issues Provider
```typescript
class GitHubProvider implements ProjectManagementProvider {
  async getWorkItems(query?: WorkItemQuery): Promise<WorkItem[]> {
    // GitHub Issues specific implementation
    const issues = await this.githubClient.getIssues(query);
    return issues.map(issue => this.mapToCommonWorkItem(issue));
  }
}
```

### 4. MCP Server with Provider Factory
```typescript
class UniversalProjectManagementServer {
  private provider: ProjectManagementProvider;
  
  constructor() {
    this.provider = this.createProvider();
  }
  
  private createProvider(): ProjectManagementProvider {
    const providerType = process.env.PM_PROVIDER || 'azuredevops';
    
    switch (providerType) {
      case 'azuredevops':
        return new AzureDevOpsProvider();
      case 'jira':
        return new JiraProvider();
      case 'github':
        return new GitHubProvider();
      default:
        throw new Error(`Unsupported provider: ${providerType}`);
    }
  }
  
  private setupToolHandlers() {
    // Generic tool handlers that work with any provider
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'get_work_items':
          return await this.getWorkItems(args);
        case 'create_work_item':
          return await this.createWorkItem(args);
        // ... other generic handlers
      }
    });
  }
}
```

### 5. Configuration-Based Provider Selection
```json
{
  "provider": "azuredevops",
  "config": {
    "organizationUrl": "https://dev.azure.com/myorg",
    "pat": "xxx"
  }
}
```

```json
{
  "provider": "jira", 
  "config": {
    "baseUrl": "https://mycompany.atlassian.net",
    "email": "user@company.com",
    "apiToken": "xxx"
  }
}
```

## Benefits
1. **Provider Agnostic**: Same MCP tools work with any backend
2. **Consistent Interface**: Common work item model across all providers
3. **Easy Extension**: Add new providers by implementing the interface
4. **Configuration Driven**: Switch providers via environment/config
5. **Capability Discovery**: Providers can expose their specific features

## Migration Strategy
1. Extract current Azure DevOps logic into `AzureDevOpsProvider`
2. Define common interfaces and types
3. Create provider factory and registry
4. Update MCP server to use generic provider interface
5. Add new providers incrementally