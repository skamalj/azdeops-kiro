import * as vscode from 'vscode';
import { AuthenticationService } from './services/AuthenticationService';
import { AzureDevOpsApiClient } from './services/AzureDevOpsApiClient';
import { AzureDevOpsExplorerProvider } from './ui/providers/AzureDevOpsExplorerProvider';
import { ConnectionProvider } from './ui/providers/ConnectionProvider';
import { StatusBarManager } from './ui/managers/StatusBarManager';
import { CommandManager } from './ui/managers/CommandManager';


let authService: AuthenticationService;
let apiClient: AzureDevOpsApiClient;
let explorerProvider: AzureDevOpsExplorerProvider;
let connectionProvider: ConnectionProvider;
let statusBarManager: StatusBarManager;
let commandManager: CommandManager;


// Global refresh function
export async function refreshExtensionUI() {
    if (authService && explorerProvider && connectionProvider && statusBarManager) {
        await updateConnectionContext();
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('=== Azure DevOps Integration extension ACTIVATION STARTED ===');
    
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
    
        // Initialize UI providers
        console.log('Initializing UI providers...');
        explorerProvider = new AzureDevOpsExplorerProvider(apiClient);
        console.log('AzureDevOpsExplorerProvider created');
        connectionProvider = new ConnectionProvider(authService, apiClient);
        console.log('ConnectionProvider created');
        statusBarManager = new StatusBarManager(apiClient);
        console.log('StatusBarManager created');
        commandManager = new CommandManager(authService, apiClient, explorerProvider, updateConnectionContext);
        console.log('CommandManager created');

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

        // Add all disposables to context
        console.log(`Registering ${commands.length} commands with context...`);
        context.subscriptions.push(...commands);
        context.subscriptions.push(statusBarManager);
        
        console.log('=== Azure DevOps extension activation completed successfully ===');
        
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