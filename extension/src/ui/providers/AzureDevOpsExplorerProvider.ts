import * as vscode from 'vscode';
import { AzureDevOpsApiClient } from '../../services/AzureDevOpsApiClient';
import { ProjectManager } from '../../services/ProjectManager';
import { TestCaseManager } from '../../services/TestCaseManager';
import { WorkItem, Project, TestPlan, TestCase } from '../../types';

// Base tree item class for all Azure DevOps items
export abstract class AzureDevOpsTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'section' | 'project' | 'workitem' | 'testplan' | 'testcase' | 'info'
    ) {
        super(label, collapsibleState);
    }
}

// Section tree item for main categories
export class SectionTreeItem extends AzureDevOpsTreeItem {
    constructor(
        public readonly sectionName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(sectionName, collapsibleState, 'section');
        this.contextValue = 'section';
        this.iconPath = this.getSectionIcon(sectionName);
    }

    private getSectionIcon(sectionName: string): vscode.ThemeIcon {
        switch (sectionName) {
            case 'Projects':
                return new vscode.ThemeIcon('organization');
            case 'Work Items':
                return new vscode.ThemeIcon('list-unordered');
            case 'Test Plans':
                return new vscode.ThemeIcon('beaker');
            default:
                return new vscode.ThemeIcon('folder');
        }
    }
}

// Project tree item
export class ProjectTreeItem extends AzureDevOpsTreeItem {
    constructor(
        public readonly project: Project,
        public readonly isSelected: boolean = false
    ) {
        super(project.name, vscode.TreeItemCollapsibleState.None, 'project');
        this.description = isSelected ? '(Current)' : project.description;
        this.tooltip = `${project.name}\n${project.description}\nState: ${project.state}`;
        this.contextValue = isSelected ? 'selectedProject' : 'project';
        this.iconPath = new vscode.ThemeIcon(isSelected ? 'check' : 'circle-outline');
        
        // Add command to select project
        if (!isSelected) {
            this.command = {
                command: 'azureDevOps.selectProjectFromTree',
                title: 'Select Project',
                arguments: [this.project]
            };
        }
    }
}

// Test plan tree item
export class TestPlanTreeItem extends AzureDevOpsTreeItem {
    constructor(
        public readonly testPlan: TestPlan,
        public readonly hasTestCases: boolean = false
    ) {
        super(`#${testPlan.id} ${testPlan.name}`, hasTestCases ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'testplan');
        this.description = testPlan.state;
        this.tooltip = `Test Plan #${testPlan.id}: ${testPlan.name}\nState: ${testPlan.state}\nIteration: ${testPlan.iterationPath}`;
        this.contextValue = 'testplan';
        this.iconPath = new vscode.ThemeIcon('beaker');
    }
}

// Test case tree item
export class TestCaseTreeItem extends AzureDevOpsTreeItem {
    constructor(
        public readonly testCase: TestCase,
        public readonly parent?: TestPlanTreeItem
    ) {
        super(`#${testCase.id} ${testCase.title}`, vscode.TreeItemCollapsibleState.None, 'testcase');
        this.description = `${testCase.state} (${testCase.priority})`;
        this.tooltip = `Test Case #${testCase.id}: ${testCase.title}\nState: ${testCase.state}\nPriority: ${testCase.priority}\nSteps: ${testCase.steps.length}`;
        this.contextValue = 'testcase';
        this.iconPath = new vscode.ThemeIcon('test-view-icon', this.getPriorityColor(testCase.priority));
        
        // Add command for test case execution
        this.command = {
            command: 'azureDevOps.executeTestCase',
            title: 'Execute Test Case',
            arguments: [this]
        };
    }

    private getPriorityColor(priority: string): vscode.ThemeColor | undefined {
        switch (priority.toLowerCase()) {
            case 'critical':
                return new vscode.ThemeColor('charts.red');
            case 'high':
                return new vscode.ThemeColor('charts.orange');
            case 'medium':
                return new vscode.ThemeColor('charts.yellow');
            case 'low':
                return new vscode.ThemeColor('charts.green');
            default:
                return undefined;
        }
    }
}

// Work item tree item (enhanced from original)
export class WorkItemTreeItem extends AzureDevOpsTreeItem {
    constructor(
        public readonly workItem: WorkItem,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent?: WorkItemTreeItem
    ) {
        super(`#${workItem.id} ${workItem.title}`, collapsibleState, 'workitem');
        
        this.tooltip = `${workItem.type} #${workItem.id}: ${workItem.title}`;
        this.description = workItem.state;
        
        // Set context value for menu contributions
        this.contextValue = workItem.type.toLowerCase().replace(/\s+/g, '');
        
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
            case 'Epic':
                return new vscode.ThemeIcon('milestone', this.getStateColor(state));
            case 'User Story':
                return new vscode.ThemeIcon('book', this.getStateColor(state));
            case 'Issue':
                return new vscode.ThemeIcon('issues', this.getStateColor(state));
            case 'Task':
                return new vscode.ThemeIcon('checklist', this.getStateColor(state));
            case 'Bug':
                return new vscode.ThemeIcon('bug', this.getStateColor(state));
            case 'Feature':
                return new vscode.ThemeIcon('star', this.getStateColor(state));
            case 'Product Backlog Item':
                return new vscode.ThemeIcon('package', this.getStateColor(state));
            default:
                return new vscode.ThemeIcon('circle', this.getStateColor(state));
        }
    }

    private getStateColor(state: string): vscode.ThemeColor | undefined {
        const normalizedState = state.toLowerCase().trim();
        
        // New/Initial states (Blue)
        if (['new', 'to do', 'proposed', 'approved', 'open'].includes(normalizedState)) {
            return new vscode.ThemeColor('charts.blue');
        }
        
        // Active/In Progress states (Green)
        if (['active', 'in progress', 'doing', 'committed', 'in development', 'in review'].includes(normalizedState)) {
            return new vscode.ThemeColor('charts.green');
        }
        
        // Completed/Done states (Gray) - This should handle all completion states consistently
        if (['resolved', 'done', 'completed', 'closed', 'finished', 'ready for deployment', 'deployed'].includes(normalizedState)) {
            return new vscode.ThemeColor('charts.gray');
        }
        
        // Removed/Cancelled states (Purple)
        if (['removed', 'cancelled', 'cut', 'inactive'].includes(normalizedState)) {
            return new vscode.ThemeColor('charts.purple');
        }
        
        // Blocked/Problem states (Red)
        if (['blocked', 'failed', 'rejected', 'on hold'].includes(normalizedState)) {
            return new vscode.ThemeColor('charts.red');
        }
        
        // Default fallback
        return new vscode.ThemeColor('foreground');
    }
}

export class AzureDevOpsExplorerProvider implements vscode.TreeDataProvider<AzureDevOpsTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AzureDevOpsTreeItem | undefined | null | void> = new vscode.EventEmitter<AzureDevOpsTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AzureDevOpsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private workItems: WorkItem[] = [];
    private userStories: Map<number, WorkItem> = new Map(); // Root-level work items (no parent)
    private tasks: Map<number, WorkItem[]> = new Map(); // Child work items grouped by parent ID
    private projects: Project[] = [];
    private testPlans: TestPlan[] = [];
    private testCases: Map<number, TestCase[]> = new Map(); // testPlanId -> testCases

    constructor(
        private apiClient: AzureDevOpsApiClient,
        private projectManager: ProjectManager,
        private testCaseManager: TestCaseManager
    ) {
        // Listen for project changes
        this.projectManager.onProjectChanged(() => {
            this.refresh();
        });
    }

    refresh(): void {
        // Only load work items if the API client is ready
        if (this.apiClient.isReady()) {
            this.loadWorkItems();
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AzureDevOpsTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AzureDevOpsTreeItem): Promise<AzureDevOpsTreeItem[]> {
        console.log('AzureDevOpsExplorerProvider.getChildren called', element ? `with element: ${element.itemType}` : 'root level');
        
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
                            projectId: '',
                            tags: []
                        },
                        vscode.TreeItemCollapsibleState.None
                    )
                ];
            }

            if (!element) {
                // Root level - show main sections
                return [
                    new SectionTreeItem('Projects', vscode.TreeItemCollapsibleState.Expanded),
                    new SectionTreeItem('Work Items', vscode.TreeItemCollapsibleState.Expanded),
                    new SectionTreeItem('Test Plans', vscode.TreeItemCollapsibleState.Collapsed)
                ];
            }

            // Handle different element types
            switch (element.itemType) {
                case 'section':
                    return await this.getSectionChildren(element as SectionTreeItem);
                case 'workitem':
                    return await this.getWorkItemChildren(element as WorkItemTreeItem);
                case 'testplan':
                    return await this.getTestPlanChildren(element as TestPlanTreeItem);
                default:
                    return [];
            }
        } catch (error) {
            console.error('AzureDevOpsExplorerProvider.getChildren error:', error);
            return [
                new WorkItemTreeItem(
                    {
                        id: 0,
                        title: `Error loading items: ${error}`,
                        type: 'Info',
                        state: 'Error',
                        description: 'Check console for details',
                        assignedTo: '',
                        createdDate: new Date(),
                        changedDate: new Date(),
                        projectId: '',
                        tags: []
                    },
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }
    }

    private async getSectionChildren(section: SectionTreeItem): Promise<AzureDevOpsTreeItem[]> {
        switch (section.sectionName) {
            case 'Projects':
                return await this.getProjectChildren();
            case 'Work Items':
                return await this.getWorkItemSectionChildren();
            case 'Test Plans':
                return await this.getTestPlanSectionChildren();
            default:
                return [];
        }
    }

    private async getProjectChildren(): Promise<ProjectTreeItem[]> {
        try {
            this.projects = await this.projectManager.getAccessibleProjects();
            const currentProject = this.projectManager.getCurrentProject();
            
            return this.projects.map(project => 
                new ProjectTreeItem(project, currentProject?.id === project.id)
            );
        } catch (error) {
            console.error('Failed to load projects:', error);
            return [];
        }
    }

    private async getWorkItemSectionChildren(): Promise<WorkItemTreeItem[]> {
        await this.loadWorkItems();
        
        // Get all root-level items (items without parents)
        const rootItems: WorkItemTreeItem[] = [];
        
        // Convert userStories map values to array and create tree items
        Array.from(this.userStories.values()).forEach(rootItem => {
            const hasChildren = this.tasks.has(rootItem.id);
            rootItems.push(new WorkItemTreeItem(
                rootItem,
                hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            ));
        });
        
        if (rootItems.length === 0) {
            return [
                new WorkItemTreeItem(
                    {
                        id: 0,
                        title: 'No work items found',
                        type: 'Info',
                        state: 'Empty',
                        description: 'Create your first work item using the command palette',
                        assignedTo: '',
                        createdDate: new Date(),
                        changedDate: new Date(),
                        projectId: '',
                        tags: []
                    },
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }
        
        return rootItems;
    }

    private async getTestPlanSectionChildren(): Promise<TestPlanTreeItem[]> {
        try {
            const currentProject = this.projectManager.getCurrentProject();
            if (!currentProject) {
                return [];
            }

            this.testPlans = await this.testCaseManager.getTestPlans(currentProject.id);
            
            // Load test cases for each test plan to determine if they have children
            const testPlanItems: TestPlanTreeItem[] = [];
            for (const testPlan of this.testPlans) {
                const testCases = await this.testCaseManager.getTestCases(currentProject.id, testPlan.id);
                this.testCases.set(testPlan.id, testCases);
                testPlanItems.push(new TestPlanTreeItem(testPlan, testCases.length > 0));
            }
            
            return testPlanItems;
        } catch (error) {
            console.error('Failed to load test plans:', error);
            return [];
        }
    }

    private async getWorkItemChildren(workItem: WorkItemTreeItem): Promise<WorkItemTreeItem[]> {
        // Child level - show tasks for the parent work item (Epic, User Story, Issue, etc.)
        const tasks = this.tasks.get(workItem.workItem.id) || [];
        return tasks.map(task => 
            new WorkItemTreeItem(task, vscode.TreeItemCollapsibleState.None, workItem)
        );
    }

    private async getTestPlanChildren(testPlan: TestPlanTreeItem): Promise<TestCaseTreeItem[]> {
        const testCases = this.testCases.get(testPlan.testPlan.id) || [];
        return testCases.map(testCase => 
            new TestCaseTreeItem(testCase, testPlan)
        );
    }

    private async loadWorkItems(): Promise<void> {
        try {
            // Get all work items - don't filter by type, get everything
            const allWorkItems = await this.apiClient.getWorkItems({});
            
            // Build parent-child hierarchy based on actual parentId relationships
            this.workItems = allWorkItems;
            this.userStories.clear(); // Will store root-level items (items without parents)
            this.tasks.clear(); // Will store children grouped by parent ID
            
            // Create maps for quick lookup
            const workItemMap = new Map<number, WorkItem>();
            allWorkItems.forEach(item => workItemMap.set(item.id, item));
            
            // Separate root items (no parent) from child items (have parent)
            const rootItems: WorkItem[] = [];
            const childItems: WorkItem[] = [];
            
            allWorkItems.forEach(item => {
                if (!item.parentId) {
                    // Root level item - no parent
                    rootItems.push(item);
                } else {
                    // Child item - has a parent
                    childItems.push(item);
                }
            });
            
            // Store root items in userStories map (for backward compatibility with existing code)
            rootItems.forEach(item => this.userStories.set(item.id, item));
            
            // Group child items by their parent ID
            childItems.forEach(child => {
                if (child.parentId) {
                    if (!this.tasks.has(child.parentId)) {
                        this.tasks.set(child.parentId, []);
                    }
                    this.tasks.get(child.parentId)!.push(child);
                }
            });
            
            // Log the hierarchy for debugging
            const rootItemTypes = rootItems.map(item => item.type);
            const childItemTypes = childItems.map(item => item.type);
            const uniqueRootTypes = [...new Set(rootItemTypes)];
            const uniqueChildTypes = [...new Set(childItemTypes)];
            
            console.log(`Loaded work item hierarchy:`);
            console.log(`  Root items: ${rootItems.length} (types: ${uniqueRootTypes.join(', ')})`);
            console.log(`  Child items: ${childItems.length} (types: ${uniqueChildTypes.join(', ')})`);
            console.log(`  Parent-child relationships: ${this.tasks.size}`);
            
        } catch (error) {
            console.error('Failed to load work items:', error);
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
     * Get all root-level work items for parent selection (items without parents)
     */
    async getUserStories(): Promise<WorkItem[]> {
        try {
            // Get all work items and filter to root-level items (no parent)
            const allWorkItems = await this.apiClient.getWorkItems({});
            return allWorkItems.filter(item => !item.parentId);
        } catch (error) {
            console.error('Failed to load root-level work items:', error);
            return [];
        }
    }
}