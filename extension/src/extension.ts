import * as vscode from 'vscode';
import { AuthenticationService } from './services/AuthenticationService';
import { AzureDevOpsApiClient } from './services/AzureDevOpsApiClient';
import { ProjectManager } from './services/ProjectManager';
import { TestCaseManager } from './services/TestCaseManager';
import { ScrumDashboard } from './services/ScrumDashboard';
import { AzureDevOpsExplorerProvider } from './ui/providers/AzureDevOpsExplorerProvider';
import { ConnectionProvider } from './ui/providers/ConnectionProvider';
import { StatusBarManager } from './ui/managers/StatusBarManager';
import { CommandManager } from './ui/managers/CommandManager';
import { MCPServerService } from './services/MCPServerService';


let authService: AuthenticationService;
let apiClient: AzureDevOpsApiClient;
let projectManager: ProjectManager;
let testCaseManager: TestCaseManager;
let scrumDashboard: ScrumDashboard;
let explorerProvider: AzureDevOpsExplorerProvider;
let connectionProvider: ConnectionProvider;
let statusBarManager: StatusBarManager;
let commandManager: CommandManager;
let mcpServerService: MCPServerService;


// Global refresh function
export async function refreshExtensionUI() {
    if (authService && explorerProvider && connectionProvider && statusBarManager) {
        await updateConnectionContext();
    }
}

// Auto-connection function
async function attemptAutoConnection() {
    try {
        const config = vscode.workspace.getConfiguration('azureDevOps');
        const orgUrl = config.get<string>('organizationUrl');
        const projectName = config.get<string>('projectName');
        const pat = config.get<string>('personalAccessToken');

        if (orgUrl && projectName && pat) {
            console.log('Found existing configuration, attempting auto-connection...');
            
            // Try to authenticate
            const authResult = await authService.authenticate({
                organizationUrl: orgUrl,
                projectName: projectName,
                authType: 'PAT',
                token: pat
            });

            if (authResult.success) {
                console.log('Auto-connection successful');
                
                // Initialize API client
                apiClient.initialize(orgUrl, projectName);
                
                // Try to get current project info and update ProjectManager
                try {
                    const projects = await projectManager.getAccessibleProjects();
                    const currentProject = projects.find(p => p.name === projectName);
                    if (currentProject) {
                        await projectManager.switchProject(currentProject.id);
                        console.log('Auto-switched to configured project:', projectName);
                    }
                } catch (error) {
                    console.warn('Could not auto-switch to project:', error);
                }
                
                // Update UI
                await updateConnectionContext();
                
                vscode.window.showInformationMessage(`🔗 Auto-connected to ${projectName}`);
            } else {
                console.log('Auto-connection failed:', authResult.error);
                vscode.window.showWarningMessage('Azure DevOps configuration found but connection failed. Please check your settings.');
            }
        } else {
            console.log('No complete configuration found, skipping auto-connection');
        }
    } catch (error) {
        console.error('Error during auto-connection:', error);
        // Don't show error to user for auto-connection failures
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // VERY FIRST THING - show we're alive
    vscode.window.showInformationMessage('🚨 COMPASS EXTENSION ACTIVATE FUNCTION CALLED!');
    console.log('=== COMPASS EXTENSION ACTIVATION STARTED ===');
    
    // Show immediate activation message
    vscode.window.showInformationMessage('Azure DevOps Extension Activating...');
    
    try {
        console.log('Extension context received:', !!context);
    
        // Initialize services
        console.log('Initializing services...');
        authService = new AuthenticationService();
        console.log('AuthenticationService created');
        apiClient = new AzureDevOpsApiClient(authService);
        console.log('AzureDevOpsApiClient created');
        projectManager = new ProjectManager(apiClient, authService);
        console.log('ProjectManager created');
        testCaseManager = new TestCaseManager(apiClient, authService);
        console.log('TestCaseManager created');
        scrumDashboard = new ScrumDashboard(apiClient, authService, projectManager);
        console.log('ScrumDashboard created');
    
        // Initialize UI providers
        console.log('Initializing UI providers...');
        explorerProvider = new AzureDevOpsExplorerProvider(apiClient, projectManager, testCaseManager);
        console.log('AzureDevOpsExplorerProvider created');
        connectionProvider = new ConnectionProvider(authService, apiClient);
        console.log('ConnectionProvider created');
        statusBarManager = new StatusBarManager(apiClient);
        console.log('StatusBarManager created');
        commandManager = new CommandManager(authService, apiClient, explorerProvider, updateConnectionContext);
        console.log('CommandManager created');

        // Initialize MCP Server Service
        mcpServerService = new MCPServerService();
        console.log('MCPServerService created');

    // Register tree data providers
    console.log('Registering tree data providers...');
    
    const explorerTreeView = vscode.window.createTreeView('azureDevOpsExplorer', {
        treeDataProvider: explorerProvider,
        showCollapseAll: true
    });
    console.log('Explorer tree view created');

    const connectionTreeView = vscode.window.createTreeView('azureDevOpsConnection', {
        treeDataProvider: connectionProvider
    });
    console.log('Connection tree view created');

    // Add tree views to disposables
    context.subscriptions.push(explorerTreeView, connectionTreeView);

    // Listen for project changes and update connection provider
    console.log('Setting up project change listener...');
    const projectChangeListener = projectManager.onProjectChanged((projectContext) => {
        console.log('Project changed to:', projectContext.project.name);
        connectionProvider.updateCurrentProject(projectContext.project.name);
        // Also refresh the explorer to show project-specific work items
        explorerProvider.refresh();
    });
    context.subscriptions.push(projectChangeListener);

        // Register commands
        console.log('Registering commands...');
        const commands = [
        vscode.commands.registerCommand('azureDevOps.connect', async () => {
            try {
                await commandManager.connect();
            } catch (error) {
                console.error('Error in connect command:', error);
                vscode.window.showErrorMessage(`Connect failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.disconnect', async () => {
            try {
                await commandManager.disconnect();
            } catch (error) {
                console.error('Error in disconnect command:', error);
                vscode.window.showErrorMessage(`Disconnect failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.selectTask', async () => {
            try {
                await commandManager.selectTask();
            } catch (error) {
                console.error('Error in selectTask command:', error);
                vscode.window.showErrorMessage(`Select task failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.completeTask', async () => {
            try {
                await commandManager.completeTask();
            } catch (error) {
                console.error('Error in completeTask command:', error);
                vscode.window.showErrorMessage(`Complete task failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.createUserStory', async () => {
            try {
                await commandManager.createUserStory();
            } catch (error) {
                console.error('Error in createUserStory command:', error);
                vscode.window.showErrorMessage(`Create user story failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.createTask', async () => {
            try {
                await commandManager.createTask();
            } catch (error) {
                console.error('Error in createTask command:', error);
                vscode.window.showErrorMessage(`Create task failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.syncWorkItems', async () => {
            try {
                await commandManager.syncWorkItems();
            } catch (error) {
                console.error('Error in syncWorkItems command:', error);
                vscode.window.showErrorMessage(`Sync work items failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.showMyTasks', async () => {
            try {
                await commandManager.showMyTasks();
            } catch (error) {
                console.error('Error in showMyTasks command:', error);
                vscode.window.showErrorMessage(`Show my tasks failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.searchWorkItems', async () => {
            try {
                await commandManager.searchWorkItems();
            } catch (error) {
                console.error('Error in searchWorkItems command:', error);
                vscode.window.showErrorMessage(`Search work items failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.refreshExplorer', () => {
            try {
                explorerProvider.refresh();
            } catch (error) {
                console.error('Error in refresh command:', error);
                vscode.window.showErrorMessage(`Refresh failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.configurePAT', async () => {
            try {
                await commandManager.configurePAT();
            } catch (error) {
                console.error('Error in configurePAT command:', error);
                vscode.window.showErrorMessage(`Configure PAT failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.testCreateStory', async () => {
            try {
                await commandManager.testCreateStory();
            } catch (error) {
                console.error('Error in testCreateStory command:', error);
                vscode.window.showErrorMessage(`Test create story failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.diagnostics', async () => {
            try {
                await runDiagnostics();
            } catch (error) {
                console.error('Error in diagnostics command:', error);
                vscode.window.showErrorMessage(`Diagnostics failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.test', () => {
            console.log('Test command executed!');
            vscode.window.showInformationMessage('Azure DevOps extension is working! Commands are registered.');
        }),
        
        // Context menu commands
        vscode.commands.registerCommand('azureDevOps.startTask', async (item: any) => {
            try {
                await commandManager.startTask(item);
            } catch (error) {
                console.error('Error in startTask command:', error);
                vscode.window.showErrorMessage(`Start task failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.viewTask', async (item: any) => {
            try {
                await commandManager.viewTask(item);
            } catch (error) {
                console.error('Error in viewTask command:', error);
                vscode.window.showErrorMessage(`View task failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('azureDevOps.editTask', async (item: any) => {
            try {
                await commandManager.editTask(item);
            } catch (error) {
                console.error('Error in editTask command:', error);
                vscode.window.showErrorMessage(`Edit task failed: ${error}`);
            }
        }),

        // New project management commands
        vscode.commands.registerCommand('azureDevOps.selectProject', async () => {
            try {
                await projectManager.showProjectSelector();
            } catch (error) {
                console.error('Error in selectProject command:', error);
                vscode.window.showErrorMessage(`Select project failed: ${error}`);
            }
        }),

        // New test case management commands
        vscode.commands.registerCommand('azureDevOps.createTestCase', async () => {
            try {
                await testCaseManager.showTestCaseCreationDialog();
            } catch (error) {
                console.error('Error in createTestCase command:', error);
                vscode.window.showErrorMessage(`Create test case failed: ${error}`);
            }
        }),

        vscode.commands.registerCommand('azureDevOps.createTestPlan', async () => {
            try {
                const currentProject = projectManager.getCurrentProject();
                if (!currentProject) {
                    vscode.window.showWarningMessage('Please select a project first');
                    return;
                }
                await testCaseManager.showTestPlanCreationDialog(currentProject.id);
            } catch (error) {
                console.error('Error in createTestPlan command:', error);
                vscode.window.showErrorMessage(`Create test plan failed: ${error}`);
            }
        }),

        vscode.commands.registerCommand('azureDevOps.executeTestCase', async (item: any) => {
            try {
                if (!item || !item.id) {
                    vscode.window.showWarningMessage('Please select a test case to execute');
                    return;
                }

                // Show test execution dialog
                const outcomeItems = [
                    { label: 'Passed', description: 'Test case passed successfully' },
                    { label: 'Failed', description: 'Test case failed' },
                    { label: 'Blocked', description: 'Test case was blocked' },
                    { label: 'Not Applicable', description: 'Test case is not applicable' }
                ];

                const selectedOutcome = await vscode.window.showQuickPick(outcomeItems, {
                    placeHolder: 'Select test execution outcome'
                });

                if (!selectedOutcome) return;

                const comment = await vscode.window.showInputBox({
                    prompt: 'Enter execution comments (optional)',
                    placeHolder: 'Additional details about the test execution'
                });

                const result = {
                    outcome: selectedOutcome.label as 'Passed' | 'Failed' | 'Blocked' | 'Not Applicable',
                    comment: comment || '',
                    executedBy: 'Current User', // In a full implementation, get from auth service
                    executedDate: new Date()
                };

                await testCaseManager.executeTestCase(item.id, result);
            } catch (error) {
                console.error('Error in executeTestCase command:', error);
                vscode.window.showErrorMessage(`Execute test case failed: ${error}`);
            }
        }),

        // New scrum dashboard command
        vscode.commands.registerCommand('azureDevOps.showScrumDashboard', async () => {
            try {
                await scrumDashboard.showDashboard();
            } catch (error) {
                console.error('Error in showScrumDashboard command:', error);
                vscode.window.showErrorMessage(`Show scrum dashboard failed: ${error}`);
            }
        }),

        // New command for selecting project from tree
        vscode.commands.registerCommand('azureDevOps.selectProjectFromTree', async (project: any) => {
            try {
                if (project && project.id && project.name) {
                    await projectManager.switchProject(project.id);
                    vscode.window.showInformationMessage(`Switched to project: ${project.name}`);
                }
            } catch (error) {
                console.error('Error in selectProjectFromTree command:', error);
                vscode.window.showErrorMessage(`Select project failed: ${error}`);
            }
        }),

        // Sprint filter command
        vscode.commands.registerCommand('azureDevOps.selectSprintFilter', async () => {
            try {
                const availableSprints = explorerProvider.getAvailableSprints();
                const currentFilter = explorerProvider.getSprintFilter();
                
                // Create quick pick items
                const quickPickItems = [
                    {
                        label: 'All Sprints',
                        description: currentFilter === 'all' ? '(Current)' : '',
                        value: 'all'
                    },
                    ...availableSprints.map(sprint => ({
                        label: sprint.name,
                        description: currentFilter === sprint.path ? '(Current)' : '',
                        value: sprint.path
                    }))
                ];
                
                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select sprint to filter work items',
                    title: 'Sprint Filter'
                });
                
                if (selected) {
                    explorerProvider.setSprintFilter(selected.value);
                    const displayName = selected.value === 'all' ? 'All Sprints' : selected.label;
                    vscode.window.showInformationMessage(`Work items filtered by: ${displayName}`);
                }
            } catch (error) {
                console.error('Error in selectSprintFilter command:', error);
                vscode.window.showErrorMessage(`Sprint filter failed: ${error}`);
            }
        })
    ];

    // Initialize status bar
    statusBarManager.initialize();

        // Load stored authentication (including from settings)
        console.log('Loading stored authentication...');
        try {
            await authService.loadStoredAuth();
            console.log('Authentication loaded, status:', authService.isAuthenticated());
        } catch (error) {
            console.error('Error loading authentication:', error);
        }
        
        // Update context and UI based on authentication status
        console.log('Updating connection context...');
        try {
            await updateConnectionContext();
            console.log('Connection context updated');
        } catch (error) {
            console.error('Error updating connection context:', error);
        }
    
        // If authenticated, initialize API client
        if (authService.isAuthenticated()) {
            console.log('User is authenticated, initializing API client...');
            const credentials = authService.getCurrentCredentials();
            if (credentials) {
                apiClient.initialize(credentials.organizationUrl, credentials.projectName);
                console.log('API client initialized');
            }
        } else {
            console.log('User not authenticated, skipping API client initialization');
        }

        // Set up auto-sync if enabled
        console.log('Setting up auto-sync...');
        setupAutoSync(context);

        // Start MCP Server
        console.log('Starting MCP Server...');
        vscode.window.showInformationMessage('🧭 Compass extension activated - starting MCP server...');
        
        try {
            await mcpServerService.startMCPServer();
            console.log('MCP Server started successfully');
        } catch (error) {
            console.error('Failed to start MCP Server:', error);
            vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
            // Don't fail extension activation if MCP server fails
        }

        // Add all disposables to context
        console.log(`Registering ${commands.length} commands with context...`);
        context.subscriptions.push(...commands);
        context.subscriptions.push(statusBarManager);
        context.subscriptions.push(mcpServerService);
        
        console.log('=== Azure DevOps extension activation completed successfully ===');
        
        // Auto-connect if configuration is available
        console.log('Checking for existing configuration...');
        await attemptAutoConnection();
        
        // Show success message
        vscode.window.showInformationMessage('✅ Azure DevOps Extension Activated Successfully!');
    
    } catch (error) {
        console.error('Error during Azure DevOps extension activation:', error);
        vscode.window.showErrorMessage(`Azure DevOps extension failed to activate: ${error}`);
    }
}

export function deactivate() {
    console.log('Azure DevOps Integration extension is now deactivated!');
}





async function updateConnectionContext() {
    const isConnected = authService.isAuthenticated();
    await vscode.commands.executeCommand('setContext', 'azureDevOps.connected', isConnected);
    
    // Always refresh both providers to update their display
    explorerProvider.refresh();
    connectionProvider.refresh();
    
    if (isConnected) {
        statusBarManager.updateStatus();
    }
}

async function runDiagnostics() {
    const diagnostics = [];
    
    try {
        // Check extension activation
        diagnostics.push(`✅ Extension activated successfully`);
        
        // Check services
        diagnostics.push(`Auth Service: ${authService ? '✅ Initialized' : '❌ Not initialized'}`);
        diagnostics.push(`API Client: ${apiClient ? '✅ Initialized' : '❌ Not initialized'}`);
        diagnostics.push(`Explorer Provider: ${explorerProvider ? '✅ Initialized' : '❌ Not initialized'}`);
        diagnostics.push(`Connection Provider: ${connectionProvider ? '✅ Initialized' : '❌ Not initialized'}`);
        
        // Check authentication
        const isAuth = authService?.isAuthenticated();
        diagnostics.push(`Authentication: ${isAuth ? '✅ Authenticated' : '❌ Not authenticated'}`);
        
        // Check settings
        const config = vscode.workspace.getConfiguration('azureDevOps');
        const orgUrl = config.get<string>('organizationUrl');
        const project = config.get<string>('projectName');
        const pat = config.get<string>('personalAccessToken');
        
        diagnostics.push(`Settings - Org URL: ${orgUrl ? '✅ Set' : '❌ Not set'}`);
        diagnostics.push(`Settings - Project: ${project ? '✅ Set' : '❌ Not set'}`);
        diagnostics.push(`Settings - PAT: ${pat ? '✅ Set' : '❌ Not set'}`);
        
        // Test tree data providers
        try {
            const connectionItems = await connectionProvider?.getChildren();
            diagnostics.push(`Connection Provider: ${connectionItems?.length || 0} items`);
        } catch (error) {
            diagnostics.push(`❌ Connection Provider Error: ${error}`);
        }
        
        try {
            const explorerItems = await explorerProvider?.getChildren();
            diagnostics.push(`Explorer Provider: ${explorerItems?.length || 0} items`);
        } catch (error) {
            diagnostics.push(`❌ Explorer Provider Error: ${error}`);
        }
        
    } catch (error) {
        diagnostics.push(`❌ Diagnostics Error: ${error}`);
    }
    
    const report = diagnostics.join('\n');
    console.log('=== Azure DevOps Extension Diagnostics ===');
    console.log(report);
    
    vscode.window.showInformationMessage('Diagnostics completed. Check console for details.', 'Copy to Clipboard')
        .then(selection => {
            if (selection === 'Copy to Clipboard') {
                vscode.env.clipboard.writeText(report);
            }
        });
}

function setupAutoSync(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const autoSync = config.get<boolean>('autoSync', true);
    const syncInterval = config.get<number>('syncInterval', 300) * 1000; // Convert to milliseconds

    if (autoSync && authService.isAuthenticated()) {
        const syncTimer = setInterval(() => {
            if (authService.isAuthenticated()) {
                explorerProvider.refresh();
            }
        }, syncInterval);

        context.subscriptions.push({
            dispose: () => clearInterval(syncTimer)
        });
    }
}