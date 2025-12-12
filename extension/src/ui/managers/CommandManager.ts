import * as vscode from 'vscode';
import { AuthenticationService } from '../../services/AuthenticationService';
import { AzureDevOpsApiClient } from '../../services/AzureDevOpsApiClient';
import { AzureDevOpsExplorerProvider, WorkItemTreeItem } from '../providers/AzureDevOpsExplorerProvider';
import { AuthCredentials, WorkItemFields } from '../../types';

export class CommandManager {
    constructor(
        private authService: AuthenticationService,
        private apiClient: AzureDevOpsApiClient,
        private explorerProvider: AzureDevOpsExplorerProvider,
        private refreshUI?: () => Promise<void>
    ) {}

    async connect(): Promise<void> {
        try {
            // First check if settings are already configured
            const config = vscode.workspace.getConfiguration('azureDevOps');
            const hasSettings = config.get<string>('organizationUrl') && 
                              config.get<string>('projectName') && 
                              config.get<string>('personalAccessToken');

            if (hasSettings) {
                // Try to connect using settings
                await this.connectFromSettings();
            } else {
                // Prompt user to configure settings
                const choice = await vscode.window.showInformationMessage(
                    'Azure DevOps settings not configured. How would you like to connect?',
                    'Configure Settings',
                    'Enter Credentials Once'
                );

                if (choice === 'Configure Settings') {
                    await this.openSettings();
                } else if (choice === 'Enter Credentials Once') {
                    await this.connectWithPrompt();
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
    }

    private async connectFromSettings(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting to Azure DevOps...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Loading settings...' });
            
            const authResult = await this.authService.loadFromSettings();
            
            if (authResult && authResult.success) {
                progress.report({ increment: 50, message: 'Initializing API client...' });
                
                const credentials = this.authService.getCurrentCredentials();
                if (credentials) {
                    this.apiClient.initialize(credentials.organizationUrl, credentials.projectName);
                }
                
                progress.report({ increment: 100, message: 'Connected successfully!' });
                
                // Update context and refresh UI
                await vscode.commands.executeCommand('setContext', 'azureDevOps.connected', true);
                if (this.refreshUI) {
                    await this.refreshUI();
                } else {
                    this.explorerProvider.refresh();
                }
                
                vscode.window.showInformationMessage('Successfully connected to Azure DevOps using settings!');
            } else {
                throw new Error('Failed to authenticate with configured settings. Please check your settings.');
            }
        });
    }

    private async connectWithPrompt(): Promise<void> {
        const credentials = await this.promptForCredentials();
        if (!credentials) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting to Azure DevOps...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Authenticating...' });
            
            const result = await this.authService.authenticate(credentials);
            
            if (result.success) {
                progress.report({ increment: 50, message: 'Initializing API client...' });
                this.apiClient.initialize(credentials.organizationUrl, credentials.projectName);
                
                progress.report({ increment: 100, message: 'Connected successfully!' });
                
                // Update context and refresh UI
                await vscode.commands.executeCommand('setContext', 'azureDevOps.connected', true);
                if (this.refreshUI) {
                    await this.refreshUI();
                } else {
                    this.explorerProvider.refresh();
                }
                
                vscode.window.showInformationMessage('Successfully connected to Azure DevOps!');
            } else {
                throw new Error(result.error || 'Authentication failed');
            }
        });
    }

    private async openSettings(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'azureDevOps');
        vscode.window.showInformationMessage(
            'Configure your Azure DevOps settings, then use "Azure DevOps: Connect" again.',
            'Learn More'
        ).then(selection => {
            if (selection === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'));
            }
        });
    }

    async disconnect(): Promise<void> {
        try {
            await this.authService.logout();
            await vscode.commands.executeCommand('setContext', 'azureDevOps.connected', false);
            await vscode.commands.executeCommand('setContext', 'azureDevOps.hasActiveTask', false);
            
            if (this.refreshUI) {
                await this.refreshUI();
            } else {
                this.explorerProvider.refresh();
            }
            vscode.window.showInformationMessage('Disconnected from Azure DevOps');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
        }
    }

    async selectTask(): Promise<void> {
        try {
            const tasks = await this.explorerProvider.getMyTasks();
            
            if (tasks.length === 0) {
                vscode.window.showInformationMessage('No tasks found. Create a task first.');
                return;
            }

            const quickPickItems = tasks.map(task => ({
                label: `#${task.id}: ${task.title}`,
                description: task.state,
                detail: task.description,
                task: task
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a task to work on',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // Set as active task and update status
                // This would integrate with StatusBarManager
                vscode.window.showInformationMessage(`Selected task: ${selected.task.title}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to select task: ${error}`);
        }
    }

    async completeTask(): Promise<void> {
        // This would integrate with the task intelligence engine
        vscode.window.showInformationMessage('Task completion feature coming soon!');
    }

    async createUserStory(): Promise<void> {
        try {
            const title = await vscode.window.showInputBox({
                prompt: 'Enter user story title',
                placeHolder: 'As a user, I want to...'
            });

            if (!title) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Enter user story description (optional)',
                placeHolder: 'Detailed description of the user story'
            });

            const storyPointsInput = await vscode.window.showQuickPick(
                ['1', '2', '3', '5', '8', '13', '21'],
                { placeHolder: 'Select story points (optional)' }
            );

            const fields: WorkItemFields = {
                title,
                description: description || '',
                storyPoints: storyPointsInput ? parseInt(storyPointsInput) : undefined
            };

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating user story...',
                cancellable: false
            }, async () => {
                const workItem = await this.apiClient.createWorkItem('User Story', fields);
                this.explorerProvider.refresh();
                vscode.window.showInformationMessage(`Created user story #${workItem.id}: ${workItem.title}`);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create user story: ${error}`);
        }
    }

    async createTask(): Promise<void> {
        try {
            const title = await vscode.window.showInputBox({
                prompt: 'Enter task title',
                placeHolder: 'Task title'
            });

            if (!title) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Enter task description (optional)',
                placeHolder: 'Detailed description of the task'
            });

            const remainingWorkInput = await vscode.window.showInputBox({
                prompt: 'Enter remaining work in hours (optional)',
                placeHolder: '8'
            });

            // Ask if user wants to link this task to a parent user story
            let parentStoryId: number | undefined;
            const linkToStory = await vscode.window.showQuickPick(
                ['Create independent task', 'Link to existing user story'],
                {
                    placeHolder: 'Do you want to link this task to a user story?',
                    canPickMany: false
                }
            );

            if (linkToStory === 'Link to existing user story') {
                parentStoryId = await this.selectParentStory();
            }

            const fields: WorkItemFields = {
                title,
                description: description || '',
                remainingWork: remainingWorkInput ? parseFloat(remainingWorkInput) : undefined
            };

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating task...',
                cancellable: false
            }, async () => {
                const workItem = await this.apiClient.createWorkItem('Task', fields, parentStoryId);
                this.explorerProvider.refresh();
                
                const parentInfo = parentStoryId ? ` under User Story #${parentStoryId}` : ' (independent)';
                vscode.window.showInformationMessage(`Created task #${workItem.id}: ${workItem.title}${parentInfo}`);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task: ${error}`);
        }
    }

    /**
     * Show dropdown to select a parent user story
     */
    private async selectParentStory(): Promise<number | undefined> {
        try {
            // Get all user stories
            const userStories = await this.apiClient.getWorkItems({ type: 'User Story' });
            
            if (userStories.length === 0) {
                vscode.window.showWarningMessage('No user stories found. Create a user story first or create an independent task.');
                return undefined;
            }

            // Create quick pick items for user stories
            const storyPickItems = userStories.map(story => ({
                label: `#${story.id}: ${story.title}`,
                description: story.state,
                detail: story.description || 'No description',
                storyId: story.id
            }));

            // Add option to cancel
            storyPickItems.unshift({
                label: '$(close) Cancel - Create independent task',
                description: '',
                detail: 'Create task without linking to any user story',
                storyId: -1
            });

            const selectedStory = await vscode.window.showQuickPick(storyPickItems, {
                placeHolder: 'Select a user story to link this task to',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selectedStory || selectedStory.storyId === -1) {
                return undefined;
            }

            return selectedStory.storyId;
        } catch (error) {
            console.error('Error selecting parent story:', error);
            vscode.window.showErrorMessage(`Failed to load user stories: ${error}`);
            return undefined;
        }
    }

    async syncWorkItems(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing work items...',
                cancellable: false
            }, async () => {
                this.explorerProvider.refresh();
            });
            
            vscode.window.showInformationMessage('Work items synced successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to sync work items: ${error}`);
        }
    }

    async showMyTasks(): Promise<void> {
        try {
            const tasks = await this.explorerProvider.getMyTasks();
            
            if (tasks.length === 0) {
                vscode.window.showInformationMessage('No tasks assigned to you.');
                return;
            }

            const quickPickItems = tasks.map(task => ({
                label: `#${task.id}: ${task.title}`,
                description: task.state,
                detail: task.description
            }));

            await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Your assigned tasks',
                canPickMany: false
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load your tasks: ${error}`);
        }
    }

    async searchWorkItems(): Promise<void> {
        try {
            const searchText = await vscode.window.showInputBox({
                prompt: 'Enter search terms',
                placeHolder: 'Search work items by title or description'
            });

            if (!searchText) return;

            const workItems = await this.explorerProvider.searchWorkItems(searchText);
            
            if (workItems.length === 0) {
                vscode.window.showInformationMessage('No work items found matching your search.');
                return;
            }

            const quickPickItems = workItems.map(item => ({
                label: `#${item.id}: ${item.title}`,
                description: `${item.type} - ${item.state}`,
                detail: item.description
            }));

            await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Found ${workItems.length} work items`,
                canPickMany: false
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to search work items: ${error}`);
        }
    }

    async startTask(item: WorkItemTreeItem): Promise<void> {
        try {
            // Update task state to "In Progress"
            await this.apiClient.updateWorkItem(item.workItem.id, [
                {
                    op: 'replace',
                    path: '/fields/System.State',
                    value: 'In Progress'
                }
            ]);

            this.explorerProvider.refresh();
            vscode.window.showInformationMessage(`Started task #${item.workItem.id}: ${item.workItem.title}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start task: ${error}`);
        }
    }

    async viewTask(item: WorkItemTreeItem): Promise<void> {
        // Open task details in a webview or show information
        const task = item.workItem;
        const message = `Task #${task.id}: ${task.title}\n\nType: ${task.type}\nState: ${task.state}\nAssigned To: ${task.assignedTo || 'Unassigned'}\n\nDescription:\n${task.description}`;
        
        vscode.window.showInformationMessage(message, 'Edit Task', 'View in Browser')
            .then(selection => {
                if (selection === 'Edit Task') {
                    this.editTask(item);
                } else if (selection === 'View in Browser') {
                    // Open in Azure DevOps web interface
                    const config = vscode.workspace.getConfiguration('azureDevOps');
                    const orgUrl = config.get<string>('organizationUrl', '');
                    const projectName = config.get<string>('projectName', '');
                    const url = `${orgUrl}/${projectName}/_workitems/edit/${task.id}`;
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
            });
    }

    async editTask(item: WorkItemTreeItem): Promise<void> {
        // Simple edit - in a real implementation, this would open a proper form
        const newTitle = await vscode.window.showInputBox({
            prompt: 'Edit task title',
            value: item.workItem.title
        });

        if (newTitle && newTitle !== item.workItem.title) {
            try {
                await this.apiClient.updateWorkItem(item.workItem.id, [
                    {
                        op: 'replace',
                        path: '/fields/System.Title',
                        value: newTitle
                    }
                ]);

                this.explorerProvider.refresh();
                vscode.window.showInformationMessage(`Updated task #${item.workItem.id}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update task: ${error}`);
            }
        }
    }

    async configurePAT(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('azureDevOps');
            
            // Get current values
            const currentOrgUrl = config.get<string>('organizationUrl', '');
            const currentProject = config.get<string>('projectName', '');
            
            // Prompt for organization URL if not set
            const orgUrl = await vscode.window.showInputBox({
                prompt: 'Enter Azure DevOps organization URL',
                placeHolder: 'https://dev.azure.com/yourorg',
                value: currentOrgUrl
            });
            
            if (!orgUrl) return;
            
            // Prompt for project name if not set
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter project name',
                placeHolder: 'YourProject',
                value: currentProject
            });
            
            if (!projectName) return;
            
            // Prompt for PAT token
            const pat = await vscode.window.showInputBox({
                prompt: 'Enter Personal Access Token (PAT)',
                placeHolder: 'Your Azure DevOps PAT with Work Items permissions',
                password: true
            });
            
            if (!pat) return;
            
            // Update configuration
            await config.update('organizationUrl', orgUrl, vscode.ConfigurationTarget.Global);
            await config.update('projectName', projectName, vscode.ConfigurationTarget.Global);
            await config.update('personalAccessToken', pat, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage('Azure DevOps configuration saved! Use "Azure DevOps: Connect" to connect.');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to configure settings: ${error}`);
        }
    }

    async testCreateStory(): Promise<void> {
        try {
            // Check if we're authenticated
            if (!this.authService.isAuthenticated()) {
                // Try to load from settings first
                await this.authService.loadStoredAuth();
                
                if (!this.authService.isAuthenticated()) {
                    const choice = await vscode.window.showWarningMessage(
                        'Not connected to Azure DevOps. Would you like to configure and connect?',
                        'Configure Settings',
                        'Connect Now'
                    );
                    
                    if (choice === 'Configure Settings') {
                        await this.configurePAT();
                        return;
                    } else if (choice === 'Connect Now') {
                        await this.connect();
                        return;
                    } else {
                        return;
                    }
                }
            }
            
            // Create a test user story
            const userStoryData: WorkItemFields = {
                title: 'Kiro Extension Test Story',
                description: `
# Test User Story Created by Kiro Extension

## Overview
This user story was created automatically by the Kiro Azure DevOps extension to test the integration functionality.

## Details
- **Created**: ${new Date().toISOString()}
- **Extension**: Kiro Azure DevOps Integration v1.0.0
- **Method**: Direct extension command execution
- **Authentication**: Settings-based PAT authentication

## Acceptance Criteria
✅ Extension successfully connected to Azure DevOps
✅ User story creation command executed
✅ Work item created in Azure DevOps
✅ Extension UI updated with new work item

## Next Steps
1. Verify the story appears in Azure DevOps web interface
2. Test creating tasks linked to this story
3. Test other extension commands (sync, view tasks, etc.)
4. Continue with remaining implementation tasks

## Technical Notes
This demonstrates the extension's ability to:
- Read configuration from VS Code settings
- Authenticate using Personal Access Token
- Create work items via Azure DevOps REST API
- Integrate seamlessly with Kiro IDE workflow

Created by: Kiro Azure DevOps Extension
                `.trim()
            };
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating test user story...',
                cancellable: false
            }, async () => {
                const workItem = await this.apiClient.createWorkItem('User Story', userStoryData);
                this.explorerProvider.refresh();
                
                const viewInBrowser = 'View in Azure DevOps';
                const createTask = 'Create Related Task';
                
                const choice = await vscode.window.showInformationMessage(
                    `✅ Test story created successfully!\n\nID: #${workItem.id}\nTitle: ${workItem.title}`,
                    viewInBrowser,
                    createTask
                );
                
                if (choice === viewInBrowser) {
                    const config = vscode.workspace.getConfiguration('azureDevOps');
                    const orgUrl = config.get<string>('organizationUrl', '');
                    const projectName = config.get<string>('projectName', '');
                    const url = `${orgUrl}/${projectName}/_workitems/edit/${workItem.id}`;
                    vscode.env.openExternal(vscode.Uri.parse(url));
                } else if (choice === createTask) {
                    // Create a related task
                    await this.createRelatedTask(workItem.id);
                }
            });
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create test story: ${error}`);
        }
    }
    
    private async createRelatedTask(parentId: number): Promise<void> {
        try {
            const taskData: WorkItemFields = {
                title: 'Test Task for Kiro Extension',
                description: `
# Test Task Created by Kiro Extension

## Objective
Verify that the Kiro Azure DevOps extension can create tasks and link them to parent work items.

## Parent Work Item
This task is linked to User Story #${parentId}

## Test Checklist
- [ ] Task appears in Azure DevOps
- [ ] Task is properly linked to parent story
- [ ] Extension UI shows the relationship
- [ ] Task can be updated via extension
- [ ] Task state can be changed

## Created By
Kiro Azure DevOps Extension - Automated Task Creation
Date: ${new Date().toISOString()}
                `.trim()
            };
            
            const task = await this.apiClient.createWorkItem('Task', taskData, parentId);
            this.explorerProvider.refresh();
            
            vscode.window.showInformationMessage(
                `✅ Related task created!\n\nID: #${task.id}\nParent: #${parentId}`
            );
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create related task: ${error}`);
        }
    }

    private async promptForCredentials(): Promise<AuthCredentials | undefined> {
        const config = vscode.workspace.getConfiguration('azureDevOps');
        
        const organizationUrl = await vscode.window.showInputBox({
            prompt: 'Enter Azure DevOps organization URL',
            placeHolder: 'https://dev.azure.com/yourorg or https://yourorg.visualstudio.com',
            value: config.get<string>('organizationUrl', '')
        });

        if (!organizationUrl) return undefined;

        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter project name',
            placeHolder: 'MyProject',
            value: config.get<string>('projectName', '')
        });

        if (!projectName) return undefined;

        const token = await vscode.window.showInputBox({
            prompt: 'Enter Personal Access Token (PAT)',
            placeHolder: 'Your Azure DevOps PAT',
            password: true
        });

        if (!token) return undefined;

        return {
            organizationUrl,
            projectName,
            authType: 'PAT',
            token
        };
    }
}