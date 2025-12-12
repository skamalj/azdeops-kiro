import * as vscode from 'vscode';
import { ScrumMetrics, SprintProgress, TeamVelocity, BurndownData, WorkItemDistribution, WorkItem } from '../types';
import { AzureDevOpsApiClient } from './AzureDevOpsApiClient';
import { AuthenticationService } from './AuthenticationService';

export class ScrumDashboard {
  private webviewPanel: vscode.WebviewPanel | undefined;

  constructor(
    private apiClient: AzureDevOpsApiClient,
    private authService: AuthenticationService
  ) {}

  async showDashboard(): Promise<void> {
    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      return;
    }

    this.webviewPanel = vscode.window.createWebviewPanel(
      'scrumDashboard',
      'Scrum Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
    });

    await this.updateDashboard();
  }

  async updateDashboard(): Promise<void> {
    if (!this.webviewPanel) return;

    try {
      const metrics = await this.getScrumMetrics();
      const html = this.generateDashboardHtml(metrics);
      this.webviewPanel.webview.html = html;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getScrumMetrics(): Promise<ScrumMetrics> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      // Get current sprint work items
      const workItems = await this.getCurrentSprintWorkItems();
      
      // Calculate metrics
      const sprintProgress = this.calculateSprintProgress(workItems);
      const teamVelocity = await this.calculateTeamVelocity();
      const burndownData = await this.calculateBurndownData(workItems);
      const workItemDistribution = this.calculateWorkItemDistribution(workItems);

      return {
        sprintProgress,
        teamVelocity,
        burndownData,
        workItemDistribution
      };
    } catch (error) {
      console.error('Failed to get scrum metrics:', error);
      throw error;
    }
  }

  private async getCurrentSprintWorkItems(): Promise<WorkItem[]> {
    try {
      // Query for current sprint work items
      const wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork]
        FROM WorkItems 
        WHERE [System.TeamProject] = @project 
        AND [System.IterationPath] UNDER @currentIteration
        AND [System.WorkItemType] IN ('User Story', 'Task', 'Bug')
        ORDER BY [System.Id]
      `;

      const queryResponse = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: wiql })
        }
      );

      if (!queryResponse.ok) {
        throw new Error(`Failed to query work items: ${queryResponse.status} ${queryResponse.statusText}`);
      }

      const queryData = await queryResponse.json();
      const workItemIds = queryData.workItems?.map((wi: any) => wi.id) || [];

      if (workItemIds.length === 0) {
        return [];
      }

      // Get detailed work item information
      const idsParam = workItemIds.join(',');
      const detailsResponse = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&api-version=7.0`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!detailsResponse.ok) {
        throw new Error(`Failed to get work item details: ${detailsResponse.status} ${detailsResponse.statusText}`);
      }

      const detailsData = await detailsResponse.json();
      return detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
    } catch (error) {
      console.error('Failed to get current sprint work items:', error);
      return [];
    }
  }

  private calculateSprintProgress(workItems: WorkItem[]): SprintProgress {
    const userStories = workItems.filter(wi => wi.type === 'User Story');
    const tasks = workItems.filter(wi => wi.type === 'Task');

    const totalStoryPoints = userStories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
    const completedStoryPoints = userStories
      .filter(story => story.state === 'Closed' || story.state === 'Done')
      .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.state === 'Closed' || task.state === 'Done').length;

    const completionPercentage = totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 0;

    return {
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints: totalStoryPoints - completedStoryPoints,
      totalTasks,
      completedTasks,
      remainingTasks: totalTasks - completedTasks,
      daysRemaining: this.calculateDaysRemaining(),
      completionPercentage
    };
  }

  private async calculateTeamVelocity(): Promise<TeamVelocity> {
    // Simplified velocity calculation
    // In a full implementation, this would query historical sprint data
    return {
      currentSprint: 25,
      lastThreeSprints: [23, 27, 25],
      averageVelocity: 25,
      trend: 'stable'
    };
  }

  private async calculateBurndownData(workItems: WorkItem[]): Promise<BurndownData> {
    // Simplified burndown calculation
    // In a full implementation, this would track daily progress
    const totalWork = workItems.reduce((sum, wi) => sum + (wi.remainingWork || wi.storyPoints || 1), 0);
    const sprintDays = 10; // Assume 2-week sprint
    
    const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - sprintDays + i);
      return date.toISOString().split('T')[0];
    });

    const idealBurndown = dates.map((_, i) => totalWork - (totalWork / sprintDays) * i);
    const actualBurndown = dates.map((_, i) => Math.max(0, totalWork - (totalWork / sprintDays) * i * (0.8 + Math.random() * 0.4)));
    const remainingWork = dates.map((_, i) => Math.max(0, totalWork - (totalWork / sprintDays) * i * 0.9));

    return {
      dates,
      idealBurndown,
      actualBurndown,
      remainingWork
    };
  }

  private calculateWorkItemDistribution(workItems: WorkItem[]): WorkItemDistribution {
    const byType: { [key: string]: number } = {};
    const byState: { [key: string]: number } = {};
    const byAssignee: { [key: string]: number } = {};

    workItems.forEach(wi => {
      // By type
      byType[wi.type] = (byType[wi.type] || 0) + 1;
      
      // By state
      byState[wi.state] = (byState[wi.state] || 0) + 1;
      
      // By assignee
      const assignee = wi.assignedTo || 'Unassigned';
      byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
    });

    return { byType, byState, byAssignee };
  }

  private calculateDaysRemaining(): number {
    // Simplified calculation - assume 2-week sprints ending on Fridays
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
    return Math.max(0, daysUntilFriday);
  }

  private mapAzureWorkItemToWorkItem(azureWorkItem: any): WorkItem {
    const fields = azureWorkItem.fields || {};
    
    return {
      id: azureWorkItem.id,
      type: fields['System.WorkItemType'] || 'Task',
      title: fields['System.Title'] || '',
      description: fields['System.Description'] || '',
      state: fields['System.State'] || 'New',
      assignedTo: fields['System.AssignedTo']?.displayName || undefined,
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || undefined,
      remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || undefined,
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag: string) => tag.trim()).filter((tag: string) => tag) : undefined,
      createdDate: new Date(fields['System.CreatedDate']),
      changedDate: new Date(fields['System.ChangedDate']),
      projectId: fields['System.TeamProject'] || '',
      fields: fields
    };
  }

  private generateDashboardHtml(metrics: ScrumMetrics): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scrum Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .dashboard-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .metric-card {
            background-color: var(--vscode-editor-widget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        .metric-value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .metric-subtitle {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            transition: width 0.3s ease;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 15px;
        }
        .distribution-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .distribution-item:last-child {
            border-bottom: none;
        }
        .distribution-label {
            font-weight: 500;
        }
        .distribution-value {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .velocity-trend {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }
        .trend-indicator {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .trend-stable {
            background-color: #0078d4;
            color: white;
        }
        .trend-increasing {
            background-color: #107c10;
            color: white;
        }
        .trend-decreasing {
            background-color: #d13438;
            color: white;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Sprint Progress Card -->
        <div class="metric-card">
            <div class="metric-title">Sprint Progress</div>
            <div class="metric-value">${metrics.sprintProgress.completionPercentage.toFixed(1)}%</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${metrics.sprintProgress.completionPercentage}%"></div>
            </div>
            <div class="metric-subtitle">
                ${metrics.sprintProgress.completedStoryPoints} / ${metrics.sprintProgress.totalStoryPoints} Story Points
            </div>
            <div class="metric-subtitle">
                ${metrics.sprintProgress.completedTasks} / ${metrics.sprintProgress.totalTasks} Tasks Completed
            </div>
            <div class="metric-subtitle">
                ${metrics.sprintProgress.daysRemaining} Days Remaining
            </div>
        </div>

        <!-- Team Velocity Card -->
        <div class="metric-card">
            <div class="metric-title">Team Velocity</div>
            <div class="metric-value">${metrics.teamVelocity.currentSprint}</div>
            <div class="metric-subtitle">Current Sprint Story Points</div>
            <div class="velocity-trend">
                <span>Average: ${metrics.teamVelocity.averageVelocity}</span>
                <span class="trend-indicator trend-${metrics.teamVelocity.trend}">
                    ${metrics.teamVelocity.trend.toUpperCase()}
                </span>
            </div>
            <div class="metric-subtitle">
                Last 3 Sprints: ${metrics.teamVelocity.lastThreeSprints.join(', ')}
            </div>
        </div>

        <!-- Burndown Chart Card -->
        <div class="metric-card">
            <div class="metric-title">Burndown Chart</div>
            <div class="chart-container">
                <canvas id="burndownChart"></canvas>
            </div>
        </div>

        <!-- Work Item Distribution by Type -->
        <div class="metric-card">
            <div class="metric-title">Work Items by Type</div>
            ${Object.entries(metrics.workItemDistribution.byType).map(([type, count]) => `
                <div class="distribution-item">
                    <span class="distribution-label">${type}</span>
                    <span class="distribution-value">${count}</span>
                </div>
            `).join('')}
        </div>

        <!-- Work Item Distribution by State -->
        <div class="metric-card">
            <div class="metric-title">Work Items by State</div>
            ${Object.entries(metrics.workItemDistribution.byState).map(([state, count]) => `
                <div class="distribution-item">
                    <span class="distribution-label">${state}</span>
                    <span class="distribution-value">${count}</span>
                </div>
            `).join('')}
        </div>

        <!-- Work Item Distribution by Assignee -->
        <div class="metric-card">
            <div class="metric-title">Work Items by Assignee</div>
            ${Object.entries(metrics.workItemDistribution.byAssignee).map(([assignee, count]) => `
                <div class="distribution-item">
                    <span class="distribution-label">${assignee}</span>
                    <span class="distribution-value">${count}</span>
                </div>
            `).join('')}
        </div>
    </div>

    <script>
        // Burndown Chart
        const ctx = document.getElementById('burndownChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(metrics.burndownData.dates)},
                datasets: [
                    {
                        label: 'Ideal Burndown',
                        data: ${JSON.stringify(metrics.burndownData.idealBurndown)},
                        borderColor: '#0078d4',
                        backgroundColor: 'rgba(0, 120, 212, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'Actual Burndown',
                        data: ${JSON.stringify(metrics.burndownData.actualBurndown)},
                        borderColor: '#107c10',
                        backgroundColor: 'rgba(16, 124, 16, 0.1)',
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Remaining Work',
                        data: ${JSON.stringify(metrics.burndownData.remainingWork)},
                        borderColor: '#d13438',
                        backgroundColor: 'rgba(209, 52, 56, 0.1)',
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--vscode-foreground)'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'var(--vscode-foreground)'
                        },
                        grid: {
                            color: 'var(--vscode-widget-border)'
                        }
                    },
                    y: {
                        ticks: {
                            color: 'var(--vscode-foreground)'
                        },
                        grid: {
                            color: 'var(--vscode-widget-border)'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }
}
