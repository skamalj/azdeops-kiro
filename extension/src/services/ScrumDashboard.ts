import * as vscode from 'vscode';
import { ScrumMetrics, SprintProgress, TeamVelocity, BurndownData, WorkItemDistribution, WorkItem } from '../types';
import { AzureDevOpsApiClient } from './AzureDevOpsApiClient';
import { AuthenticationService } from './AuthenticationService';

// Enhanced interfaces for real data foundation
interface WorkItemEffort {
  id: number;
  title: string;
  type: string;
  state: string;
  effort: number;
  assignedTo?: string;
}

interface SprintDataFoundation {
  sprintId: string;
  sprintName: string;
  startDate?: Date;
  endDate?: Date;
  totalEffort: number;
  completedEffort: number;
  remainingEffort: number;
  workItemsByState: {
    planned: WorkItemEffort[];
    inProgress: WorkItemEffort[];
    completed: WorkItemEffort[];
  };
  measurementType: 'storyPoints' | 'hours' | 'count';
}

interface VelocityData {
  sprintName: string;
  plannedEffort: number;
  completedEffort: number;
  velocityPercentage: number;
  measurementUnit: string;
}

interface EnhancedBurndownData extends BurndownData {
  measurementUnit: string;
  totalEffort: number;
  sprintDuration: number;
}

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

    // Handle messages from the webview
    this.webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refreshSprint':
            console.log('[Dashboard] Refreshing dashboard for sprint:', message.sprintPath);
            await this.updateDashboard(message.sprintPath);
            break;
        }
      }
    );

    await this.updateDashboard();
  }

  async updateDashboard(selectedSprintPath?: string): Promise<void> {
    if (!this.webviewPanel) return;

    try {
      console.log('[Dashboard] Updating dashboard with sprint:', selectedSprintPath || 'default');
      const metricsWithSprint = await this.getScrumMetrics(selectedSprintPath);
      const allWorkItems = await this.getAllWorkItems();
      const workItemMatrix = this.generateWorkItemMatrix(allWorkItems);
      const sprintMetricsMatrix = await this.generateSprintMetricsMatrix();
      const html = this.generateDashboardHtml(metricsWithSprint, workItemMatrix, sprintMetricsMatrix);
      this.webviewPanel.webview.html = html;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getScrumMetrics(selectedSprintPath?: string): Promise<ScrumMetrics & { sprintName: string, availableSprints: { id: string, name: string, path: string }[] }> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      // Get available sprints
      const availableSprints = await this.getAvailableSprints();
      
      // Get current sprint work items
      const { workItems, sprintName } = await this.getCurrentSprintWorkItems(selectedSprintPath);
      
      console.log(`[Dashboard] Calculating metrics for ${workItems.length} items in ${sprintName}`);
      
      // Calculate metrics
      const sprintProgress = this.calculateSprintProgress(workItems);
      const teamVelocity = await this.calculateTeamVelocity();
      const burndownData = await this.calculateBurndownData(workItems, selectedSprintPath);
      const workItemDistribution = this.calculateWorkItemDistribution(workItems);

      return {
        sprintProgress,
        teamVelocity,
        burndownData,
        workItemDistribution,
        sprintName,
        availableSprints
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

  /**
   * Get all available sprints for the current project
   */
  private async getAvailableSprints(): Promise<{ id: string, name: string, path: string }[]> {
    try {
      const currentProject = this.projectManager?.getCurrentProject();
      if (!currentProject) {
        return [];
      }

      // Get sprints using classification nodes API
      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/_apis/wit/classificationnodes/iterations?api-version=7.0&$depth=2`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to get sprints:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      const sprints: { id: string, name: string, path: string }[] = [];

      // Parse the classification nodes to extract sprints
      if (data.children) {
        data.children.forEach((child: any) => {
          sprints.push({
            id: child.id.toString(),
            name: child.name,
            path: child.path
          });
        });
      }

      console.log(`[Dashboard] Found ${sprints.length} available sprints:`, sprints);
      return sprints;
    } catch (error) {
      console.error('Error getting available sprints:', error);
      return [];
    }
  }

  private async getCurrentSprintWorkItems(selectedSprintPath?: string): Promise<{ workItems: WorkItem[], sprintName: string }> {
    try {
      // Get current project context
      const currentProject = this.projectManager?.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project selected. Please select a project first.');
      }

      let sprintName: string;
      let iterationPath: string;

      if (selectedSprintPath) {
        // Extract sprint name from path (e.g., "\azdevops-kiro\Iteration\Sprint 1" -> "Sprint 1")
        const pathParts = selectedSprintPath.split('\\');
        sprintName = pathParts[pathParts.length - 1] || 'Unknown Sprint';
        // Convert to assignment path format: "azdevops-kiro\Sprint 1"
        iterationPath = `${currentProject.name}\\${sprintName}`;
      } else {
        // Default to Sprint 1
        sprintName = 'Sprint 1';
        iterationPath = `${currentProject.name}\\Sprint 1`;
      }

      console.log(`[Dashboard] Getting work items for sprint: ${sprintName} using path: ${iterationPath}`);

      // Use the same approach as our working MCP tools
      // Get all work items and filter by iteration path
      const wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${currentProject.name}'
        ORDER BY [System.WorkItemType], [System.Id]
      `;

      console.log(`[Dashboard] WIQL Query: ${wiql}`);

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

      console.log(`[Dashboard] Found ${workItemIds.length} total work items in project`);

      if (workItemIds.length === 0) {
        return { workItems: [], sprintName };
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
      const allWorkItems = detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
      
      // Filter work items by iteration path
      const sprintWorkItems = allWorkItems.filter((wi: WorkItem) => {
        const wiIterationPath = wi.fields?.['System.IterationPath'] || '';
        console.log(`[Dashboard] Work item #${wi.id}: "${wi.title}" -> iteration path: "${wiIterationPath}"`);
        
        // Check if the work item's iteration path matches our target sprint
        // Try multiple path formats to be flexible
        const pathsToCheck = [
          iterationPath, // "azdevops-kiro\Sprint 1"
          `\\${iterationPath}`, // "\azdevops-kiro\Sprint 1"
          `\\${currentProject.name}\\Iteration\\${sprintName}`, // "\azdevops-kiro\Iteration\Sprint 1"
          `${currentProject.name}\\Iteration\\${sprintName}` // "azdevops-kiro\Iteration\Sprint 1"
        ];
        
        return pathsToCheck.some(path => wiIterationPath === path);
      });
      
      console.log(`[Dashboard] Filtered to ${sprintWorkItems.length} work items for ${sprintName}`);
      
      if (sprintWorkItems.length > 0) {
        console.log(`[Dashboard] Sprint work items:`, sprintWorkItems.map((wi: WorkItem) => `#${wi.id}: ${wi.title} (${wi.state})`));
      }
      
      return { workItems: sprintWorkItems, sprintName };
    } catch (error) {
      console.error('Failed to get current sprint work items:', error);
      return { workItems: [], sprintName: 'Unknown Sprint' };
    }
  }

  private calculateSprintProgress(workItems: WorkItem[]): SprintProgress {
    // Use enhanced calculation with real data foundation
    return this.calculateEnhancedSprintProgress(workItems);
  }

  private isWorkItemCompleted(workItem: WorkItem): boolean {
    // Common completed states across different process templates
    const completedStates = ['Closed', 'Done', 'Resolved', 'Completed'];
    return completedStates.includes(workItem.state);
  }

  private async calculateTeamVelocity(): Promise<TeamVelocity> {
    try {
      const allWorkItems = await this.getAllWorkItems();
      const measurementType = this.detectMeasurementType(allWorkItems);
      const effortItems = this.filterWorkItemsWithEffort(allWorkItems, measurementType);
      
      // Group work items by sprint
      const sprintData: { [sprint: string]: { total: number; completed: number } } = {};
      
      effortItems.forEach(wi => {
        const iterationPath = wi.fields?.['System.IterationPath'] || '';
        const sprintName = this.extractSprintNameFromPath(iterationPath);
        
        if (sprintName === 'No Sprint') return; // Skip unassigned items
        
        if (!sprintData[sprintName]) {
          sprintData[sprintName] = { total: 0, completed: 0 };
        }
        
        const effort = this.getWorkItemEffort(wi, measurementType);
        sprintData[sprintName].total += effort;
        
        if (this.isWorkItemCompleted(wi)) {
          sprintData[sprintName].completed += effort;
        }
      });
      
      // Calculate velocity for each sprint
      const sprintVelocities = Object.entries(sprintData)
        .map(([sprint, data]) => ({
          sprint,
          velocity: data.completed,
          total: data.total
        }))
        .sort((a, b) => a.sprint.localeCompare(b.sprint)); // Sort by sprint name
      
      console.log(`[Dashboard] Calculated velocity for ${sprintVelocities.length} sprints:`, sprintVelocities);
      
      if (sprintVelocities.length === 0) {
        return {
          currentSprint: 0,
          lastThreeSprints: [0, 0, 0],
          averageVelocity: 0,
          trend: 'stable'
        };
      }
      
      // Get current sprint (last in sorted order)
      const currentSprint = sprintVelocities[sprintVelocities.length - 1]?.velocity || 0;
      
      // Get last 3 sprints
      const lastThreeSprints = sprintVelocities
        .slice(-3)
        .map(s => s.velocity);
      
      // Pad with zeros if less than 3 sprints
      while (lastThreeSprints.length < 3) {
        lastThreeSprints.unshift(0);
      }
      
      // Calculate average
      const averageVelocity = lastThreeSprints.reduce((sum, v) => sum + v, 0) / lastThreeSprints.length;
      
      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (lastThreeSprints.length >= 2) {
        const recent = lastThreeSprints[lastThreeSprints.length - 1];
        const previous = lastThreeSprints[lastThreeSprints.length - 2];
        const change = ((recent - previous) / previous) * 100;
        
        if (change > 10) {
          trend = 'increasing';
        } else if (change < -10) {
          trend = 'decreasing';
        }
      }
      
      return {
        currentSprint,
        lastThreeSprints,
        averageVelocity: Math.round(averageVelocity),
        trend
      };
    } catch (error) {
      console.error('Failed to calculate team velocity:', error);
      return {
        currentSprint: 0,
        lastThreeSprints: [0, 0, 0],
        averageVelocity: 0,
        trend: 'stable'
      };
    }
  }

  private async calculateBurndownData(workItems: WorkItem[], selectedSprintPath?: string): Promise<EnhancedBurndownData> {
    try {
      const measurementType = this.detectMeasurementType(workItems);
      const effortItems = this.filterWorkItemsWithEffort(workItems, measurementType);
      const measurementUnit = this.getMeasurementUnitName(measurementType, workItems);
      
      // Calculate total effort using detected measurement type
      const totalEffort = effortItems.reduce((sum, wi) => sum + this.getWorkItemEffort(wi, measurementType), 0);
      const completedEffort = effortItems
        .filter(wi => this.isWorkItemCompleted(wi))
        .reduce((sum, wi) => sum + this.getWorkItemEffort(wi, measurementType), 0);
      
      console.log(`[Dashboard] Burndown: ${completedEffort}/${totalEffort} ${measurementUnit} completed`);

      // Get actual sprint dates if available
      const sprintInfo = await this.getSprintDateInfo(selectedSprintPath);
      const sprintDays = sprintInfo.workingDays;
      const dates = sprintInfo.dates;
      
      console.log(`[Dashboard] Using ${sprintDays} working days for sprint burndown`);

      // Calculate ideal burndown (linear)
      const idealBurndown = dates.map((_, i) => Math.max(0, totalEffort - (totalEffort / sprintDays) * i));
      
      // Calculate actual burndown based on current completion
      // Since we don't have historical data, show current state across all days
      const actualBurndown = dates.map((_, i) => {
        if (i === dates.length - 1) {
          // Last day shows current remaining work
          return totalEffort - completedEffort;
        } else {
          // Earlier days show total effort (no progress yet)
          return totalEffort;
        }
      });
      
      // Remaining work line shows current state
      const remainingWork = dates.map(() => totalEffort - completedEffort);

      return {
        dates,
        idealBurndown,
        actualBurndown,
        remainingWork,
        measurementUnit,
        totalEffort,
        sprintDuration: sprintDays
      };
    } catch (error) {
      console.error('Error calculating enhanced burndown data:', error);
      // Fallback to simple calculation
      const fallback = this.calculateSimpleBurndown(workItems);
      return {
        ...fallback,
        measurementUnit: 'Items',
        totalEffort: workItems.length,
        sprintDuration: 10
      };
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
        // Simple linear estimation for intermediate days
        actualProgress = completedWork * dayProgress;
      }
      
      return Math.max(0, totalWork - actualProgress);
    });
  }

  /**
   * Get sprint date information for burndown chart
   */
  private async getSprintDateInfo(selectedSprintPath?: string): Promise<{ dates: string[], workingDays: number }> {
    try {
      // Try to get actual sprint dates from Azure DevOps
      if (selectedSprintPath) {
        const currentProject = this.projectManager?.getCurrentProject();
        if (currentProject) {
          // Extract sprint name from path
          const sprintName = selectedSprintPath.split('\\').pop() || 'Sprint';
          
          // For now, use standard 2-week sprint (10 working days)
          // In a full implementation, you would query the Azure DevOps API for actual sprint dates
          const sprintDays = 10;
          const today = new Date();
          const sprintStart = new Date(today);
          sprintStart.setDate(today.getDate() - Math.floor(sprintDays / 2)); // Assume we're mid-sprint
          
          const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
            const date = new Date(sprintStart);
            date.setDate(date.getDate() + i);
            return date.toISOString().split('T')[0];
          });
          
          return { dates, workingDays: sprintDays };
        }
      }
      
      // Fallback: standard 2-week sprint
      const sprintDays = 10;
      const today = new Date();
      const sprintStart = new Date(today);
      sprintStart.setDate(today.getDate() - Math.floor(sprintDays / 2));
      
      const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
        const date = new Date(sprintStart);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });
      
      return { dates, workingDays: sprintDays };
    } catch (error) {
      console.error('Error getting sprint date info:', error);
      
      // Fallback: standard 2-week sprint
      const sprintDays = 10;
      const today = new Date();
      const sprintStart = new Date(today);
      sprintStart.setDate(today.getDate() - sprintDays);
      
      const dates = Array.from({ length: sprintDays + 1 }, (_, i) => {
        const date = new Date(sprintStart);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });
      
      return { dates, workingDays: sprintDays };
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

  // ===== ENHANCED DATA FOUNDATION METHODS =====

  /**
   * Auto-detect the measurement type used in the current project
   */
  private detectMeasurementType(workItems: WorkItem[]): 'storyPoints' | 'hours' | 'count' {
    const storyPointItems = workItems.filter(wi => wi.storyPoints && wi.storyPoints > 0);
    const remainingWorkItems = workItems.filter(wi => wi.remainingWork && wi.remainingWork > 0);
    
    console.log(`[Dashboard] Measurement detection: ${storyPointItems.length} items with story points, ${remainingWorkItems.length} items with hours`);
    
    // Check for mixed effort types
    if (storyPointItems.length > 0 && remainingWorkItems.length > 0) {
      console.log(`[Dashboard] Mixed effort types detected - will standardize using conversion ratios`);
      return this.getPreferredMeasurementType(storyPointItems.length, remainingWorkItems.length);
    } else if (storyPointItems.length > 0) {
      return 'storyPoints';
    } else if (remainingWorkItems.length > 0) {
      return 'hours';
    } else {
      // No measurable effort found - will result in no progress calculation
      console.log(`[Dashboard] No measurable effort found in work items`);
      return 'count'; // Keep for compatibility, but filterWorkItemsWithEffort will return empty array
    }
  }

  /**
   * Get preferred measurement type for mixed effort scenarios
   */
  private getPreferredMeasurementType(storyPointCount: number, hoursCount: number): 'storyPoints' | 'hours' {
    const config = vscode.workspace.getConfiguration('azureDevOps.effortConversion');
    const preferredUnit = config.get<string>('preferredUnit', 'auto');
    
    if (preferredUnit === 'storyPoints') {
      return 'storyPoints';
    } else if (preferredUnit === 'hours') {
      return 'hours';
    } else {
      // Auto mode: use the most common unit
      return storyPointCount >= hoursCount ? 'storyPoints' : 'hours';
    }
  }

  /**
   * Filter work items to only include those with measurable effort
   */
  private filterWorkItemsWithEffort(workItems: WorkItem[], measurementType: 'storyPoints' | 'hours' | 'count'): WorkItem[] {
    // Check if we have mixed effort types
    const hasStoryPoints = workItems.some(wi => wi.storyPoints && wi.storyPoints > 0);
    const hasHours = workItems.some(wi => wi.remainingWork && wi.remainingWork > 0);
    
    if (hasStoryPoints && hasHours) {
      // Mixed effort: include items with either story points OR hours
      return workItems.filter(wi => 
        (wi.storyPoints && wi.storyPoints > 0) || 
        (wi.remainingWork && wi.remainingWork > 0)
      );
    } else if (measurementType === 'storyPoints') {
      // Only include items that actually have story points assigned
      return workItems.filter(wi => wi.storyPoints && wi.storyPoints > 0);
    } else if (measurementType === 'hours') {
      // Only include items that actually have remaining work assigned
      return workItems.filter(wi => wi.remainingWork && wi.remainingWork > 0);
    } else {
      // Fallback: if no story points or hours, return empty array (no progress calculation)
      return [];
    }
  }

  /**
   * Extract effort value from work item based on measurement type with conversion
   */
  private getWorkItemEffort(workItem: WorkItem, measurementType: 'storyPoints' | 'hours' | 'count'): number {
    const config = vscode.workspace.getConfiguration('azureDevOps.effortConversion');
    const conversionRatio = config.get<number>('storyPointsToHours', 8);
    
    if (measurementType === 'storyPoints') {
      // If work item has story points, use them directly
      if (workItem.storyPoints && workItem.storyPoints > 0) {
        return workItem.storyPoints;
      }
      // If work item has hours but we want story points, convert
      if (workItem.remainingWork && workItem.remainingWork > 0) {
        return workItem.remainingWork / conversionRatio;
      }
      return 0;
    } else if (measurementType === 'hours') {
      // If work item has hours, use them directly
      if (workItem.remainingWork && workItem.remainingWork > 0) {
        return workItem.remainingWork;
      }
      // If work item has story points but we want hours, convert
      if (workItem.storyPoints && workItem.storyPoints > 0) {
        return workItem.storyPoints * conversionRatio;
      }
      return 0;
    } else {
      return 1; // Count mode: each item = 1 unit
    }
  }

  /**
   * Normalize work item states to standard categories
   */
  private normalizeWorkItemState(state: string): 'planned' | 'inProgress' | 'completed' {
    const lowerState = state.toLowerCase();
    
    // Completed states
    if (['closed', 'done', 'resolved', 'completed'].includes(lowerState)) {
      return 'completed';
    }
    
    // In progress states
    if (['active', 'in progress', 'doing', 'committed', 'approved'].includes(lowerState)) {
      return 'inProgress';
    }
    
    // Default to planned for new/to do states
    return 'planned';
  }

  /**
   * Get measurement unit display name
   */
  private getMeasurementUnitName(measurementType: 'storyPoints' | 'hours' | 'count', workItems?: WorkItem[]): string {
    if (workItems) {
      const hasStoryPoints = workItems.some(wi => wi.storyPoints && wi.storyPoints > 0);
      const hasHours = workItems.some(wi => wi.remainingWork && wi.remainingWork > 0);
      
      if (hasStoryPoints && hasHours) {
        // Mixed effort - show conversion info
        const config = vscode.workspace.getConfiguration('azureDevOps.effortConversion');
        const conversionRatio = config.get<number>('storyPointsToHours', 8);
        
        switch (measurementType) {
          case 'storyPoints': return `Story Points (${conversionRatio}h = 1pt)`;
          case 'hours': return `Hours (1pt = ${conversionRatio}h)`;
          case 'count': return 'Items';
        }
      }
    }
    
    switch (measurementType) {
      case 'storyPoints': return 'Story Points';
      case 'hours': return 'Hours';
      case 'count': return 'Items';
    }
  }

  /**
   * Calculate enhanced sprint progress with real data
   */
  private calculateEnhancedSprintProgress(workItems: WorkItem[]): SprintProgress & { measurementType: string; measurementUnit: string } {
    const measurementType = this.detectMeasurementType(workItems);
    const effortItems = this.filterWorkItemsWithEffort(workItems, measurementType);
    const measurementUnit = this.getMeasurementUnitName(measurementType, workItems);
    
    console.log(`[Dashboard] Using ${measurementType} measurement for ${effortItems.length} effort items out of ${workItems.length} total items`);
    
    // If no items with measurable effort, show message
    if (effortItems.length === 0) {
      console.log(`[Dashboard] No work items with measurable effort (${measurementType}) found`);
      return {
        totalStoryPoints: 0,
        completedStoryPoints: 0,
        remainingStoryPoints: 0,
        totalTasks: 0,
        completedTasks: 0,
        remainingTasks: 0,
        daysRemaining: this.calculateDaysRemaining(),
        completionPercentage: 0,
        measurementType,
        measurementUnit: `No ${measurementUnit}`,
        totalEffort: 0,
        completedEffort: 0
      };
    }
    
    let totalEffort = 0;
    let completedEffort = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;
    
    effortItems.forEach(wi => {
      const effort = this.getWorkItemEffort(wi, measurementType);
      totalEffort += effort;
      
      if (this.isWorkItemCompleted(wi)) {
        completedEffort += effort;
      }
      
      // Keep legacy task counting for backward compatibility
      if (wi.type === 'Task') {
        totalTasks++;
        if (this.isWorkItemCompleted(wi)) {
          completedTasks++;
        }
      }
      
      // Keep legacy story point counting for backward compatibility
      if (wi.storyPoints) {
        totalStoryPoints += wi.storyPoints;
        if (this.isWorkItemCompleted(wi)) {
          completedStoryPoints += wi.storyPoints;
        }
      }
    });
    
    const completionPercentage = totalEffort > 0 ? (completedEffort / totalEffort) * 100 : 0;
    
    console.log(`[Dashboard] Progress: ${completedEffort}/${totalEffort} ${measurementUnit} (${completionPercentage.toFixed(1)}%)`);
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints: totalStoryPoints - completedStoryPoints,
      totalTasks,
      completedTasks,
      remainingTasks: totalTasks - completedTasks,
      daysRemaining: this.calculateDaysRemaining(),
      completionPercentage,
      measurementType,
      measurementUnit,
      totalEffort,
      completedEffort
    };
  }

  /**
   * Get sprint work items with iteration path filtering
   */
  private async getSprintWorkItems(sprintPath?: string): Promise<WorkItem[]> {
    try {
      const currentProject = this.projectManager?.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project selected');
      }

      let wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
               [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints], 
               [Microsoft.VSTS.Scheduling.RemainingWork], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${currentProject.name}'
      `;

      if (sprintPath) {
        wiql += ` AND [System.IterationPath] = '${sprintPath}'`;
      }

      wiql += ` ORDER BY [System.WorkItemType], [System.Id]`;

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
        throw new Error(`Failed to query sprint work items: ${queryResponse.status}`);
      }

      const queryData = await queryResponse.json();
      const workItemIds = queryData.workItems?.map((wi: any) => wi.id) || [];

      if (workItemIds.length === 0) {
        return [];
      }

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
        throw new Error(`Failed to get sprint work item details: ${detailsResponse.status}`);
      }

      const detailsData = await detailsResponse.json();
      return detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
    } catch (error) {
      console.error('Failed to get sprint work items:', error);
      return [];
    }
  }

  /**
   * Generate sprint metrics matrix with effort totals
   */
  private async generateSprintMetricsMatrix(): Promise<{ [sprint: string]: { [state: string]: { count: number; effort: number; unit: string } } }> {
    try {
      const allWorkItems = await this.getAllWorkItems();
      const measurementType = this.detectMeasurementType(allWorkItems);
      const effortItems = this.filterWorkItemsWithEffort(allWorkItems, measurementType);
      const measurementUnit = this.getMeasurementUnitName(measurementType, allWorkItems);
      
      const matrix: { [sprint: string]: { [state: string]: { count: number; effort: number; unit: string } } } = {};
      
      effortItems.forEach(wi => {
        // Extract sprint name from iteration path
        const iterationPath = wi.fields?.['System.IterationPath'] || 'No Sprint';
        const sprintName = this.extractSprintNameFromPath(iterationPath);
        const normalizedState = this.normalizeWorkItemState(wi.state);
        const effort = this.getWorkItemEffort(wi, measurementType);
        
        if (!matrix[sprintName]) {
          matrix[sprintName] = {};
        }
        
        if (!matrix[sprintName][normalizedState]) {
          matrix[sprintName][normalizedState] = { count: 0, effort: 0, unit: measurementUnit };
        }
        
        matrix[sprintName][normalizedState].count++;
        matrix[sprintName][normalizedState].effort += effort;
      });
      
      console.log(`[Dashboard] Sprint metrics matrix generated for ${Object.keys(matrix).length} sprints`);
      return matrix;
    } catch (error) {
      console.error('Failed to generate sprint metrics matrix:', error);
      return {};
    }
  }

  /**
   * Extract sprint name from iteration path
   */
  private extractSprintNameFromPath(iterationPath: string): string {
    if (!iterationPath || iterationPath === '') {
      return 'No Sprint';
    }
    
    // Handle paths like "\ProjectName\Iteration\Sprint 1" or "\ProjectName\Sprint 1"
    const parts = iterationPath.split('\\').filter(part => part.trim() !== '');
    
    if (parts.length === 0) {
      return 'No Sprint';
    }
    
    // Return the last part (sprint name) or project name if no sprint
    const lastPart = parts[parts.length - 1];
    
    // If the last part is just the project name, return "No Sprint"
    const currentProject = this.projectManager?.getCurrentProject();
    if (currentProject && lastPart === currentProject.name) {
      return 'No Sprint';
    }
    
    return lastPart;
  }

  /**
   * Generate HTML for sprint metrics matrix
   */
  private generateSprintMetricsHtml(matrix: { [sprint: string]: { [state: string]: { count: number; effort: number; unit: string } } }): string {
    if (!matrix || Object.keys(matrix).length === 0) {
      return '';
    }

    // Get all unique states
    const allStates = new Set<string>();
    Object.values(matrix).forEach(sprintStates => {
      Object.keys(sprintStates).forEach(state => allStates.add(state));
    });
    const sortedStates = Array.from(allStates).sort();

    // Get all sprints
    const sprints = Object.keys(matrix).sort();

    // Calculate totals
    const stateTotals: { [state: string]: { count: number; effort: number } } = {};
    const sprintTotals: { [sprint: string]: { count: number; effort: number } } = {};
    let grandTotal = { count: 0, effort: 0 };
    let measurementUnit = 'Items';

    sprints.forEach(sprint => {
      sprintTotals[sprint] = { count: 0, effort: 0 };
      sortedStates.forEach(state => {
        const data = matrix[sprint][state];
        if (data) {
          sprintTotals[sprint].count += data.count;
          sprintTotals[sprint].effort += data.effort;
          
          if (!stateTotals[state]) {
            stateTotals[state] = { count: 0, effort: 0 };
          }
          stateTotals[state].count += data.count;
          stateTotals[state].effort += data.effort;
          
          grandTotal.count += data.count;
          grandTotal.effort += data.effort;
          
          measurementUnit = data.unit;
        }
      });
    });

    return `
        <!-- Sprint Metrics Matrix -->
        <div class="metric-card matrix-card">
            <div class="metric-title">Sprint Progress Matrix (Sprint vs State) - ${measurementUnit}</div>
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th>Sprint</th>
                        ${sortedStates.map(state => `<th>${state}</th>`).join('')}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${sprints.map(sprint => `
                        <tr>
                            <td class="type-header">${sprint}</td>
                            ${sortedStates.map(state => {
                                const data = matrix[sprint][state];
                                const count = data?.count || 0;
                                const effort = data?.effort || 0;
                                const display = effort > 0 ? `${effort} ${measurementUnit.toLowerCase()}` : count > 0 ? `${count} items` : '0';
                                return `<td><span class="matrix-count ${count === 0 ? 'zero' : ''}" title="${count} items, ${effort} ${measurementUnit.toLowerCase()}">${display}</span></td>`;
                            }).join('')}
                            <td><span class="matrix-count" title="${sprintTotals[sprint].count} items, ${sprintTotals[sprint].effort} ${measurementUnit.toLowerCase()}">${sprintTotals[sprint].effort > 0 ? `${sprintTotals[sprint].effort} ${measurementUnit.toLowerCase()}` : `${sprintTotals[sprint].count} items`}</span></td>
                        </tr>
                    `).join('')}
                    <tr style="border-top: 2px solid var(--vscode-widget-border);">
                        <td class="type-header"><strong>Total</strong></td>
                        ${sortedStates.map(state => {
                            const data = stateTotals[state];
                            const count = data?.count || 0;
                            const effort = data?.effort || 0;
                            const display = effort > 0 ? `${effort} ${measurementUnit.toLowerCase()}` : count > 0 ? `${count} items` : '0';
                            return `<td><span class="matrix-count" title="${count} items, ${effort} ${measurementUnit.toLowerCase()}">${display}</span></td>`;
                        }).join('')}
                        <td><span class="matrix-count"><strong title="${grandTotal.count} items, ${grandTotal.effort} ${measurementUnit.toLowerCase()}">${grandTotal.effort > 0 ? `${grandTotal.effort} ${measurementUnit.toLowerCase()}` : `${grandTotal.count} items`}</strong></span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
  }

  private generateDashboardHtml(
    metricsWithSprint: ScrumMetrics & { sprintName: string, availableSprints: { id: string, name: string, path: string }[] }, 
    workItemMatrix?: { [type: string]: { [state: string]: number } },
    sprintMetricsMatrix?: { [sprint: string]: { [state: string]: { count: number; effort: number; unit: string } } }
  ): string {
    const metrics = metricsWithSprint;
    const sprintName = metricsWithSprint.sprintName;
    const availableSprints = metricsWithSprint.availableSprints;
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
        
        /* Sprint Selector Styles */
        .sprint-selector-container {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-widget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
        }
        .sprint-selector-label {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .sprint-selector {
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
            min-width: 200px;
        }
        .sprint-selector:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .refresh-button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 600;
        }
        .refresh-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .refresh-button:active {
            background-color: var(--vscode-button-activeBackground);
        }
    </style>
</head>
<body>
    <!-- Sprint Selector -->
    <div class="sprint-selector-container">
        <label for="sprintSelector" class="sprint-selector-label">Select Sprint:</label>
        <select id="sprintSelector" class="sprint-selector">
            ${availableSprints.map(sprint => `
                <option value="${sprint.path}" ${sprint.name === sprintName ? 'selected' : ''}>
                    ${sprint.name}
                </option>
            `).join('')}
        </select>
        <button id="refreshDashboard" class="refresh-button">Refresh Dashboard</button>
    </div>

    <div class="dashboard-container">
        <!-- Sprint Progress Card -->
        <div class="metric-card">
            <div class="metric-title">Sprint Progress - ${sprintName}</div>
            <div class="metric-value">${metrics.sprintProgress.completionPercentage.toFixed(1)}%</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${metrics.sprintProgress.completionPercentage}%"></div>
            </div>
            <div class="metric-subtitle">
                <strong>Measurement:</strong> ${(metrics.sprintProgress as any).measurementUnit || 'Story Points'}
            </div>
            ${(metrics.sprintProgress as any).totalEffort === 0 ? `
                <div class="metric-subtitle" style="color: var(--vscode-errorForeground);">
                    No work items with measurable effort found in this sprint
                </div>
                <div class="metric-subtitle">
                    Please assign story points or remaining work hours to work items
                </div>
            ` : (metrics.sprintProgress as any).measurementType === 'storyPoints' ? `
                <div class="metric-subtitle">
                    ${(metrics.sprintProgress as any).completedEffort} / ${(metrics.sprintProgress as any).totalEffort} Story Points
                </div>
            ` : `
                <div class="metric-subtitle">
                    ${(metrics.sprintProgress as any).completedEffort} / ${(metrics.sprintProgress as any).totalEffort} Hours
                </div>
            `}
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
        ${sprintMetricsMatrix ? this.generateSprintMetricsHtml(sprintMetricsMatrix) : ''}
    </div>

    <script>
        // Sprint selector functionality
        const vscode = acquireVsCodeApi();
        
        document.getElementById('refreshDashboard').addEventListener('click', function() {
            const selectedSprintPath = document.getElementById('sprintSelector').value;
            console.log('Refreshing dashboard for sprint:', selectedSprintPath);
            
            // Send message to VS Code extension to refresh with selected sprint
            vscode.postMessage({
                command: 'refreshSprint',
                sprintPath: selectedSprintPath
            });
        });
        
        // Auto-refresh when sprint selection changes
        document.getElementById('sprintSelector').addEventListener('change', function() {
            const selectedSprintPath = this.value;
            console.log('Sprint selection changed to:', selectedSprintPath);
            
            // Send message to VS Code extension to refresh with selected sprint
            vscode.postMessage({
                command: 'refreshSprint',
                sprintPath: selectedSprintPath
            });
        });

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
