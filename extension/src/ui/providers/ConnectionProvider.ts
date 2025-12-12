import * as vscode from 'vscode';
import { AuthenticationService } from '../../services/AuthenticationService';
import { AzureDevOpsApiClient } from '../../services/AzureDevOpsApiClient';

class ConnectionTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.contextValue = contextValue;
    }
}

export class ConnectionProvider implements vscode.TreeDataProvider<ConnectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter<ConnectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private currentProject: string = 'Unknown';

    constructor(
        private authService: AuthenticationService,
        private apiClient: AzureDevOpsApiClient
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateCurrentProject(projectName: string): void {
        this.currentProject = projectName;
        this.refresh();
    }

    getTreeItem(element: ConnectionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
        console.log('ConnectionProvider.getChildren called', element ? 'with element' : 'root level');
        
        try {
            if (!element) {
            // Root level
            if (this.authService.isAuthenticated()) {
                return Promise.resolve([
                    new ConnectionTreeItem(
                        '✅ Connected to Azure DevOps',
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new ConnectionTreeItem(
                        `Organization: ${this.getOrganizationName()}`,
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new ConnectionTreeItem(
                        `Project: ${this.getProjectName()}`,
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new ConnectionTreeItem(
                        'Disconnect',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'azureDevOps.disconnect',
                            title: 'Disconnect from Azure DevOps'
                        },
                        'disconnect'
                    )
                ]);
            } else {
                return Promise.resolve([
                    new ConnectionTreeItem(
                        '❌ Not connected to Azure DevOps',
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new ConnectionTreeItem(
                        'Configure Settings',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'azureDevOps.configurePAT',
                            title: 'Configure Azure DevOps Settings'
                        },
                        'configure'
                    ),
                    new ConnectionTreeItem(
                        'Connect to Organization',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'azureDevOps.connect',
                            title: 'Connect to Azure DevOps'
                        },
                        'connect'
                    )
                ]);
            }
        }

            return Promise.resolve([]);
        } catch (error) {
            console.error('ConnectionProvider.getChildren error:', error);
            return Promise.resolve([
                new ConnectionTreeItem(
                    `❌ Error: ${error}`,
                    vscode.TreeItemCollapsibleState.None
                )
            ]);
        }
    }

    private getOrganizationName(): string {
        // Extract organization name from stored configuration or auth result
        const config = vscode.workspace.getConfiguration('azureDevOps');
        const orgUrl = config.get<string>('organizationUrl', '');
        
        if (orgUrl.includes('dev.azure.com')) {
            const match = orgUrl.match(/dev\.azure\.com\/([^/]+)/);
            return match ? match[1] : 'Unknown';
        } else if (orgUrl.includes('visualstudio.com')) {
            const match = orgUrl.match(/([^.]+)\.visualstudio\.com/);
            return match ? match[1] : 'Unknown';
        }
        
        return 'Unknown';
    }

    private getProjectName(): string {
        // Use current project from ProjectManager if available, otherwise fall back to config
        if (this.currentProject && this.currentProject !== 'Unknown') {
            return this.currentProject;
        }
        const config = vscode.workspace.getConfiguration('azureDevOps');
        return config.get<string>('projectName', 'Unknown');
    }
}