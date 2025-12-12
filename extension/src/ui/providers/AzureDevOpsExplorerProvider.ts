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
        super(testPlan.name, hasTestCases ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'testplan');
        this.description = `#${testPlan.id} - ${testPlan.state}`;
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
        super(testCase.title, vscode.TreeItemCollapsibleState.None, 'testcase');
        this.description = `#${testCase.id} - ${testCase.state} (${testCase.priority})`;
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
        super(workItem.title, collapsibleState, 'workitem');
        
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

export class AzureDevOpsExplorerProvider implements vscode.TreeDataProvider<AzureDevOpsTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AzureDevOpsTreeItem | undefined | null | void> = new vscode.EventEmitter<AzureDevOpsTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AzureDevOpsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private workItems: WorkItem[] = [];
    private userStories: Map<number, WorkItem> = new Map();
    private tasks: Map<number, WorkItem[]> = new Map();
    private independentTasks: WorkItem[] = [];
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
        // Child level - show tasks for the user story
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