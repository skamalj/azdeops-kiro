import * as vscode from 'vscode';
import { AzureDevOpsApiClient } from '../../services/AzureDevOpsApiClient';
import { WorkItem } from '../../types';

export class WorkItemTreeItem extends vscode.TreeItem {
    constructor(
        public readonly workItem: WorkItem,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent?: WorkItemTreeItem
    ) {
        super(workItem.title, collapsibleState);
        
        this.tooltip = `${workItem.type} #${workItem.id}: ${workItem.title}`;
        this.description = `#${workItem.id} - ${workItem.state}`;
        
        // Set context value for menu contributions
        this.contextValue = workItem.type.toLowerCase().replace(' ', '');
        
        // Set icon based on work item type
        this.iconPath = this.getIconPath(workItem.type, workItem.state);
        
        // Add command for single click
        if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'azureDevOps.viewTask',
                title: 'View Task',
                arguments: [this]
            };
        }
    }

    private getIconPath(type: string, state: string): vscode.ThemeIcon {
        switch (type) {
            case 'User Story':
                return new vscode.ThemeIcon('book', this.getStateColor(state));
            case 'Task':
                return new vscode.ThemeIcon('checklist', this.getStateColor(state));
            case 'Bug':
                return new vscode.ThemeIcon('bug', this.getStateColor(state));
            case 'Feature':
                return new vscode.ThemeIcon('star', this.getStateColor(state));
            default:
                return new vscode.ThemeIcon('circle', this.getStateColor(state));
        }
    }

    private getStateColor(state: string): vscode.ThemeColor | undefined {
        switch (state.toLowerCase()) {
            case 'new':
                return new vscode.ThemeColor('charts.blue');
            case 'active':
            case 'in progress':
                return new vscode.ThemeColor('charts.green');
            case 'resolved':
            case 'done':
                return new vscode.ThemeColor('charts.gray');
            case 'closed':
                return new vscode.ThemeColor('charts.purple');
            default:
                return undefined;
        }
    }
}

export class AzureDevOpsExplorerProvider implements vscode.TreeDataProvider<WorkItemTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorkItemTreeItem | undefined | null | void> = new vscode.EventEmitter<WorkItemTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorkItemTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private workItems: WorkItem[] = [];
    private userStories: Map<number, WorkItem> = new Map();
    private tasks: Map<number, WorkItem[]> = new Map();
    private independentTasks: WorkItem[] = [];

    constructor(private apiClient: AzureDevOpsApiClient) {}

    refresh(): void {
        // Only load work items if the API client is ready
        if (this.apiClient.isReady()) {
            this.loadWorkItems();
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkItemTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkItemTreeItem): Promise<WorkItemTreeItem[]> {
        console.log('AzureDevOpsExplorerProvider.getChildren called', element ? 'with element' : 'root level');
        
        try {
            if (!this.apiClient.isReady()) {
            // Return a placeholder item when not authenticated
            return [
                new WorkItemTreeItem(
                    {
                        id: 0,
                        title: 'Connect to Azure DevOps to view work items',
                        type: 'Info',
                        state: 'Not Connected',
                        description: 'Use the Connection panel to connect to your Azure DevOps organization',
                        assignedTo: '',
                        createdDate: new Date(),
                        changedDate: new Date(),
                        tags: []
                    },
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        if (!element) {
            // Root level - show user stories and independent tasks
            await this.loadWorkItems();
            const stories = Array.from(this.userStories.values());
            const rootItems: WorkItemTreeItem[] = [];
            
            // Add user stories (with potential child tasks)
            stories.forEach(story => {
                rootItems.push(new WorkItemTreeItem(
                    story,
                    this.tasks.has(story.id) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
                ));
            });
            
            // Add independent tasks (tasks without parent)
            this.independentTasks.forEach(task => {
                rootItems.push(new WorkItemTreeItem(task, vscode.TreeItemCollapsibleState.None));
            });
            
            if (rootItems.length === 0) {
                return [
                    new WorkItemTreeItem(
                        {
                            id: 0,
                            title: 'No work items found',
                            type: 'Info',
                            state: 'Empty',
                            description: 'Create your first user story or task using the command palette',
                            assignedTo: '',
                            createdDate: new Date(),
                            changedDate: new Date(),
                            tags: []
                        },
                        vscode.TreeItemCollapsibleState.None
                    )
                ];
            }
            
            return rootItems;
        } else {
            // Child level - show tasks for the user story
            const tasks = this.tasks.get(element.workItem.id) || [];
            return tasks.map(task => 
                new WorkItemTreeItem(task, vscode.TreeItemCollapsibleState.None, element)
            );
        }
        } catch (error) {
            console.error('AzureDevOpsExplorerProvider.getChildren error:', error);
            return [
                new WorkItemTreeItem(
                    {
                        id: 0,
                        title: `Error loading work items: ${error}`,
                        type: 'Info',
                        state: 'Error',
                        description: 'Check console for details',
                        assignedTo: '',
                        createdDate: new Date(),
                        changedDate: new Date(),
                        tags: []
                    },
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }
    }

    private async loadWorkItems(): Promise<void> {
        try {
            // Load user stories
            const stories = await this.apiClient.getWorkItems({ type: 'User Story' });
            this.userStories.clear();
            stories.forEach(story => this.userStories.set(story.id, story));

            // Load tasks
            const tasks = await this.apiClient.getWorkItems({ type: 'Task' });
            this.tasks.clear();
            this.independentTasks = [];
            
            // Group tasks by parent user story or mark as independent
            tasks.forEach(task => {
                if (task.parentId) {
                    // Task has a parent - group under user story
                    if (!this.tasks.has(task.parentId)) {
                        this.tasks.set(task.parentId, []);
                    }
                    this.tasks.get(task.parentId)!.push(task);
                } else {
                    // Independent task - show at root level
                    this.independentTasks.push(task);
                }
            });

            this.workItems = [...stories, ...tasks];
            
            console.log(`Loaded ${stories.length} user stories, ${this.independentTasks.length} independent tasks, ${tasks.length - this.independentTasks.length} linked tasks`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load work items: ${error}`);
        }
    }

    getWorkItem(id: number): WorkItem | undefined {
        return this.workItems.find(item => item.id === id);
    }

    async getMyTasks(): Promise<WorkItem[]> {
        try {
            // Get current user from authentication
            const authResult = this.apiClient.getAuthStatus();
            if (!authResult) {
                return [];
            }

            // For now, we'll filter by assigned tasks
            // In a real implementation, you'd get the current user's identity
            const tasks = await this.apiClient.getWorkItems({ 
                type: 'Task',
                // assignedTo: currentUser // Would need to implement user identity
            });

            return tasks.filter(task => task.assignedTo); // Filter to assigned tasks
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load my tasks: ${error}`);
            return [];
        }
    }

    async searchWorkItems(searchText: string): Promise<WorkItem[]> {
        try {
            return await this.apiClient.getWorkItems({ searchText });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to search work items: ${error}`);
            return [];
        }
    }

    /**
     * Get all user stories for parent selection
     */
    async getUserStories(): Promise<WorkItem[]> {
        try {
            return await this.apiClient.getWorkItems({ type: 'User Story' });
        } catch (error) {
            console.error('Failed to load user stories:', error);
            return [];
        }
    }
}