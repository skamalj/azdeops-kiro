import * as vscode from 'vscode';
import { AzureDevOpsApiClient } from '../../services/AzureDevOpsApiClient';
import { WorkItem } from '../../types';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private activeTask: WorkItem | null = null;

    constructor(private apiClient: AzureDevOpsApiClient) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
    }

    initialize(): void {
        this.updateStatus();
        this.statusBarItem.show();
    }

    updateStatus(): void {
        if (!this.apiClient.isAuthenticated()) {
            this.statusBarItem.text = '$(azure-devops) Azure DevOps: Not Connected';
            this.statusBarItem.tooltip = 'Click to connect to Azure DevOps';
            this.statusBarItem.command = 'azureDevOps.connect';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (this.activeTask) {
            this.statusBarItem.text = `$(azure-devops) Task #${this.activeTask.id}: ${this.truncateTitle(this.activeTask.title)} (${this.activeTask.state})`;
            this.statusBarItem.tooltip = `Active Task: ${this.activeTask.title}\nState: ${this.activeTask.state}\nClick for options`;
            this.statusBarItem.command = 'azureDevOps.showTaskOptions';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            this.statusBarItem.text = '$(azure-devops) Azure DevOps: Connected';
            this.statusBarItem.tooltip = 'Connected to Azure DevOps - Click to select a task';
            this.statusBarItem.command = 'azureDevOps.selectTask';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    setActiveTask(task: WorkItem | null): void {
        this.activeTask = task;
        this.updateStatus();
        
        // Update context for command availability
        vscode.commands.executeCommand('setContext', 'azureDevOps.hasActiveTask', !!task);
    }

    getActiveTask(): WorkItem | null {
        return this.activeTask;
    }

    private truncateTitle(title: string, maxLength: number = 30): string {
        if (title.length <= maxLength) {
            return title;
        }
        return title.substring(0, maxLength - 3) + '...';
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}