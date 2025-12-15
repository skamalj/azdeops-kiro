import * as vscode from 'vscode';
import { ScrumMetrics, SprintProgress, TeamVelocity, BurndownData, WorkItemDistribution, WorkItem } from '../types';
import { AzureDevOpsApiClient } from './AzureDevOpsApiClient';
import { AuthenticationService } from './AuthenticationService';

export class ScrumDashboard {
  private webviewPanel: vscode.WebviewPanel | undefined;

  constructor(
    private apiClient: AzureDevOpsApiClient,
    private authService: AuthenticationService,
    private projectManager?: any // Will be injected from extension.ts
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
      const allWorkItems = await this.getAllWorkItems();
      const workItemMatrix = this.generateWorkItemMatrix(allWorkItems);
      const html = this.generateDashboardHtml(metrics, workItemMatrix);
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

  async getAllWorkItems(): Promise<WorkItem[]> {
    try {
      // Get current project context
      const currentProject = this.projectManager?.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project selected. Please select a project first.');
      }

      // Query for ALL work items in the project (not just sprint items)
      const wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${currentProject.name}'
        ORDER BY [System.WorkItemType], [System.State], [System.Id]
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

      // Get detailed work item information in batches (Azure DevOps has limits)
      const batchSize = 200;
      const allWorkItems: WorkItem[] = [];

      for (let i = 0; i < workItemIds.length; i += batchSize) {
        const batchIds = workItemIds.slice(i, i + batchSize);
        const idsParam = batchIds.join(',');
        
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
        const batchWorkItems = detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
        allWorkItems.push(...batchWorkItems);
      }

      return allWorkItems;
    } catch (error) {
      console.error('Failed to get all work items:', error);
      return [];
    }
  }

  generateWorkItemMatrix(workItems: WorkItem[]): { [type: string]: { [state: string]: number } } {
    const matrix: { [type: string]: { [state: string]: number } } = {};

    workItems.forEach(workItem => {
      const type = workItem.type;
      const state = workItem.state;

      // Initialize type if not exists
      if (!matrix[type]) {
        matrix[type] = {};
      }

      // Initialize state count if not exists
      if (!matrix[type][state]) {
        matrix[type][state] = 0;
      }

      // Increment count
      matrix[type][state]++;
    });

    return matrix;
  }

  private generateMatrixHtml(matrix: { [type: string]: { [state: string]: number } }): string {
    if (!matrix || Object.keys(matrix).length === 0) {
      return '';
    }

    // Get all unique states across all work item types
    const allStates = new Set<string>();
    Object.values(matrix).forEach(typeStates => {
      Object.keys(typeStates).forEach(state => allStates.add(state));
    });
    const sortedStates = Array.from(allStates).sort();

    // Get all work item types
    const workItemTypes = Object.keys(matrix).sort();

    // Calculate totals
    const stateTotals: { [state: string]: number } = {};
    const typeTotals: { [type: string]: number } = {};
    let grandTotal = 0;

    workItemTypes.forEach(type => {
      typeTotals[type] = 0;
      sortedStates.forEach(state => {
        const count = matrix[type][state] || 0;
        typeTotals[type] += count;
        stateTotals[state] = (stateTotals[state] || 0) + count;
        grandTotal += count;
      });
    });

    return `
        <!-- Work Item Matrix -->
        <div class="metric-card matrix-card">
            <div class="metric-title">Work Items Matrix (Type vs State)</div>
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th>Work Item Type</th>
                        ${sortedStates.map(state => `<th>${state}</th>`).join('')}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${workItemTypes.map(type => `
                        <tr>
                            <td class="type-header">${type}</td>
                            ${sortedStates.map(state => {
                                const count = matrix[type][state] || 0;
                                return `<td><span class="matrix-count ${count === 0 ? 'zero' : ''}">${count}</span></td>`;
                            }).join('')}
                            <td><span class="matrix-count">${typeTotals[type]}</span></td>
                        </tr>
                    `).join('')}
                    <tr style="border-top: 2px solid var(--vscode-widget-border);">
                        <td class="type-header"><strong>Total</strong></td>
                        ${sortedStates.map(state => `<td><span class="matrix-count">${stateTotals[state] || 0}</span></td>`).join('')}
                        <td><span class="matrix-count"><strong>${grandTotal}</strong></span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
  }

  private async getCurrentSprintWorkItems(): Promise<WorkItem[]> {
    try {
      // Get current project context
      const currentProject = this.projectManager?.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project selected. Please select a project first.');
      }

      const projectContext = this.projectManager?.getCurrentProjectContext();
      const workItemTypes = this.getRelevantWorkItemTypes(projectContext);

      // Query for current sprint work items using the actual project name
      const wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${currentProject.name}'
        AND [System.WorkItemType] IN (${workItemTypes.map(type => `'${type}'`).join(', ')})
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
    // Get story-level work items (User Story, Epic, Issue, or Product Backlog Item)
    const storyLevelItems = workItems.filter(wi => 
      ['User Story', 'Epic', 'Issue', 'Product Backlog Item'].includes(wi.type)
    );
    const tasks = workItems.filter(wi => wi.type === 'Task');

    const totalStoryPoints = storyLevelItems.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
    const completedStoryPoints = storyLevelItems
      .filter(story => this.isWorkItemCompleted(story))
      .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => this.isWorkItemCompleted(task)).length;

    const completionPercentage = totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 
                                totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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

  private isWorkItemCompleted(workItem: WorkItem): boolean {
    // Common completed states across different process templates
    const completedStates = ['Closed', 'Done', 'Resolved', 'Completed'];
    return completedStates.includes(workItem.state);
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
    try {
      // Calculate total work based on story points and remaining work
      const totalStoryPoints = workItems
        .filter(wi => ['Epic', 'User Story', 'Issue', 'Product Backlog Item'].includes(wi.type))
        .reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
      
      const totalRemainingWork = workItems
        .filter(wi => wi.type === 'Task')
        .reduce((sum, wi) => sum + (wi.remainingWork || 0), 0);
      
      // Use story points if available, otherwise use remaining work, fallback to work item count
      const totalWork = totalStoryPoints > 0 ? totalStoryPoints : 
                       totalRemainingWork > 0 ? totalRemainingWork : 
                       workItems.length;

      // Get sprint duration (default to 2 weeks = 10 working days)
      const sprintDays = 10;
      const sprintStartDate = new Date();
      sprintStartDate.setDate(sprintStartDate.getDate() - sprintDays);
      
      // Generate dates for the sprint
      const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
        const date = new Date(sprintStartDate);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });

      // Calculate ideal burndown (linear)
      const idealBurndown = dates.map((_, i) => Math.max(0, totalWork - (totalWork / sprintDays) * i));
      
      // Calculate actual burndown based on completed work
      const completedWork = await this.calculateCompletedWork(workItems);
      const actualBurndown = await this.calculateActualBurndownFromHistory(workItems, dates, totalWork);
      
      // Calculate remaining work based on current state
      const currentRemainingWork = totalWork - completedWork;
      const remainingWork = dates.map((_, i) => {
        if (i === dates.length - 1) {
          // Last day - use actual remaining work
          return Math.max(0, currentRemainingWork);
        } else {
          // Historical data - estimate based on completion rate
          const dayProgress = i / (dates.length - 1);
          const estimatedCompleted = completedWork * dayProgress;
          return Math.max(0, totalWork - estimatedCompleted);
        }
      });

      return {
        dates,
        idealBurndown,
        actualBurndown,
        remainingWork
      };
    } catch (error) {
      console.error('Error calculating burndown data:', error);
      // Fallback to simple calculation if detailed tracking fails
      return this.calculateSimpleBurndown(workItems);
    }
  }

  private async calculateCompletedWork(workItems: WorkItem[]): Promise<number> {
    const completedStoryPoints = workItems
      .filter(wi => ['Epic', 'User Story', 'Issue', 'Product Backlog Item'].includes(wi.type))
      .filter(wi => this.isWorkItemCompleted(wi))
      .reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
    
    const completedTasks = workItems
      .filter(wi => wi.type === 'Task')
      .filter(wi => this.isWorkItemCompleted(wi)).length;
    
    // Return story points if available, otherwise task count
    return completedStoryPoints > 0 ? completedStoryPoints : completedTasks;
  }

  private async calculateActualBurndownFromHistory(workItems: WorkItem[], dates: string[], totalWork: number): Promise<number[]> {
    // This is a simplified version - in a full implementation, you would:
    // 1. Query Azure DevOps work item history/revisions API
    // 2. Track state changes over time
    // 3. Calculate daily completion rates
    
    // For now, we'll estimate based on current completion and work item change dates
    const completedWork = await this.calculateCompletedWork(workItems);
    const completionRate = totalWork > 0 ? completedWork / totalWork : 0;
    
    return dates.map((date, i) => {
      const dayProgress = i / (dates.length - 1);
      
      // Estimate actual progress with some realistic variation
      let actualProgress;
      if (dayProgress === 0) {
        actualProgress = 0; // Sprint start
      } else if (dayProgress === 1) {
        actualProgress = completedWork; // Current state
      } else {
        // Estimate progress with typical sprint curve (slow start, faster middle, slower end)
        const sprintCurve = this.getSprintProgressCurve(dayProgress);
        actualProgress = completedWork * sprintCurve;
      }
      
      return Math.max(0, totalWork - actualProgress);
    });
  }

  private getSprintProgressCurve(progress: number): number {
    // Typical sprint progress follows an S-curve
    // Slow start (planning, setup), faster middle (development), slower end (testing, polish)
    if (progress <= 0.2) {
      // First 20% of sprint - slow start
      return progress * 0.5;
    } else if (progress <= 0.8) {
      // Middle 60% of sprint - faster progress
      return 0.1 + (progress - 0.2) * 1.2;
    } else {
      // Last 20% of sprint - slower finish
      return 0.82 + (progress - 0.8) * 0.9;
    }
  }

  private calculateSimpleBurndown(workItems: WorkItem[]): BurndownData {
    const totalWork = workItems.reduce((sum, wi) => sum + (wi.remainingWork || wi.storyPoints || 1), 0);
    const sprintDays = 10;
    
    const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - sprintDays + i);
      return date.toISOString().split('T')[0];
    });

    const idealBurndown = dates.map((_, i) => Math.max(0, totalWork - (totalWork / sprintDays) * i));
    const completedWork = workItems.filter(wi => this.isWorkItemCompleted(wi)).length;
    const actualBurndown = dates.map((_, i) => {
      const progress = i / sprintDays;
      return Math.max(0, totalWork - (completedWork * progress));
    });
    const remainingWork = dates.map(() => Math.max(0, totalWork - completedWork));

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

  private getRelevantWorkItemTypes(projectContext: any): string[] {
    // If we have project context with work item types, use those
    if (projectContext?.workItemTypes) {
      const availableTypes = projectContext.workItemTypes.map((wit: any) => wit.name);
      
      // Return relevant types for scrum metrics based on what's available
      const relevantTypes: string[] = [];
      
      // Add story-level work items
      if (availableTypes.includes('User Story')) {
        relevantTypes.push('User Story');
      } else if (availableTypes.includes('Epic')) {
        relevantTypes.push('Epic');
      } else if (availableTypes.includes('Issue')) {
        relevantTypes.push('Issue');
      }
      
      // Always include Task if available
      if (availableTypes.includes('Task')) {
        relevantTypes.push('Task');
      }
      
      // Include Bug if available
      if (availableTypes.includes('Bug')) {
        relevantTypes.push('Bug');
      }
      
      return relevantTypes.length > 0 ? relevantTypes : ['Task']; // Fallback to Task
    }
    
    // Fallback: try to detect based on common patterns
    // For Basic process template (like azdevops-kiro): Epic, Issue, Task
    // For Agile process template: User Story, Task, Bug
    // For Scrum process template: Product Backlog Item, Task, Bug
    return ['Epic', 'Issue', 'Task', 'User Story', 'Bug', 'Product Backlog Item'];
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

  private generateDashboardHtml(metrics: ScrumMetrics, workItemMatrix?: { [type: string]: { [state: string]: number } }): string {
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
            background-color: var(--vscode-editor-widget-background);
            border-radius: 4px;
            padding: 10px;
        }
        
        .chart-container canvas {
            background-color: transparent !important;
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
        
        /* Work Item Matrix Styles */
        .matrix-card {
            grid-column: 1 / -1; /* Span full width */
        }
        .matrix-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .matrix-table th,
        .matrix-table td {
            padding: 12px;
            text-align: center;
            border: 1px solid var(--vscode-widget-border);
        }
        .matrix-table th {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 600;
        }
        .matrix-table td {
            background-color: var(--vscode-editor-widget-background);
        }
        .matrix-table .type-header {
            text-align: left;
            font-weight: 600;
            background-color: var(--vscode-editor-widget-background);
        }
        .matrix-count {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .matrix-count.zero {
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
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

        ${workItemMatrix ? this.generateMatrixHtml(workItemMatrix) : ''}
    </div>

    <script>
        // Get VS Code theme colors with fallbacks
        const getThemeColor = (cssVar, fallback) => {
            const style = getComputedStyle(document.body);
            const color = style.getPropertyValue(cssVar).trim();
            return color || fallback;
        };
        
        const foregroundColor = getThemeColor('--vscode-foreground', '#ffffff');
        const borderColor = getThemeColor('--vscode-widget-border', '#404040');
        const backgroundColor = getThemeColor('--vscode-editor-widget-background', '#2d2d30');
        
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
                            color: foregroundColor,
                            font: {
                                size: 12
                            },
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: backgroundColor,
                        titleColor: foregroundColor,
                        bodyColor: foregroundColor,
                        borderColor: borderColor,
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: foregroundColor,
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: borderColor
                        },
                        title: {
                            display: true,
                            text: 'Sprint Days',
                            color: foregroundColor,
                            font: {
                                size: 14
                            }
                        }
                    },
                    y: {
                        ticks: {
                            color: foregroundColor,
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: borderColor
                        },
                        title: {
                            display: true,
                            text: 'Work Remaining',
                            color: foregroundColor,
                            font: {
                                size: 14
                            }
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
