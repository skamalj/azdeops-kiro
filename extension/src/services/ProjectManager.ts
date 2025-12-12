import * as vscode from 'vscode';
import { Project, ProjectContext, ProjectPermissions, WorkItemTypeDefinition } from '../types';
import { AzureDevOpsApiClient } from './AzureDevOpsApiClient';
import { AuthenticationService } from './AuthenticationService';

export class ProjectManager {
  private currentProject: Project | null = null;
  private projectContext: ProjectContext | null = null;
  private projects: Project[] = [];
  private readonly statusBarItem: vscode.StatusBarItem;

  constructor(
    private apiClient: AzureDevOpsApiClient,
    private authService: AuthenticationService
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'azureDevOps.selectProject';
    this.updateStatusBar();
  }

  async getAccessibleProjects(): Promise<Project[]> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    try {
      const response = await fetch(
        `${this.authService.getOrganizationUrl()}/_apis/projects?api-version=7.0`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.projects = data.value.map((proj: any) => this.mapAzureProjectToProject(proj));
      return this.projects;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async switchProject(projectId: string): Promise<ProjectContext> {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    try {
      // Show progress while switching
      return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Switching to project: ${project.name}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 25, message: 'Loading project configuration...' });
        
        // Load project configuration
        const projectConfig = await this.getProjectConfiguration(projectId);
        
        progress.report({ increment: 50, message: 'Validating permissions...' });
        
        // Validate permissions
        const permissions = await this.validateProjectPermissions(projectId);
        
        progress.report({ increment: 75, message: 'Updating context...' });
        
        // Update current project context
        this.currentProject = project;
        this.projectContext = {
          project,
          workItemTypes: projectConfig.workItemTypes,
          permissions
        };

        // Update API client with new project
        this.apiClient.initialize(
          this.authService.getOrganizationUrl(),
          project.name
        );

        progress.report({ increment: 100, message: 'Project switched successfully' });
        
        this.updateStatusBar();
        
        // Fire project changed event
        this._onProjectChanged.fire(this.projectContext);
        
        return this.projectContext;
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to switch to project ${project.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  getCurrentProjectContext(): ProjectContext | null {
    return this.projectContext;
  }

  async getProjectConfiguration(projectId: string): Promise<{ workItemTypes: WorkItemTypeDefinition[] }> {
    try {
      const response = await fetch(
        `${this.authService.getOrganizationUrl()}/${projectId}/_apis/wit/workitemtypes?api-version=7.0`,
        {
          headers: {
            'Authorization': this.authService.getAuthHeader() || '',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch work item types: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const workItemTypes = data.value.map((wit: any) => this.mapAzureWorkItemTypeToDefinition(wit));

      return { workItemTypes };
    } catch (error) {
      console.error('Failed to load project configuration:', error);
      // Return default configuration if API fails
      return {
        workItemTypes: [
          {
            name: 'User Story',
            referenceName: 'Microsoft.VSTS.WorkItemTypes.UserStory',
            description: 'User Story work item type',
            color: '#009CCC',
            icon: 'icon_book',
            states: ['New', 'Active', 'Resolved', 'Closed'],
            fields: []
          },
          {
            name: 'Task',
            referenceName: 'Microsoft.VSTS.WorkItemTypes.Task',
            description: 'Task work item type',
            color: '#F2CB1D',
            icon: 'icon_clipboard',
            states: ['New', 'Active', 'Closed'],
            fields: []
          }
        ]
      };
    }
  }

  async validateProjectPermissions(projectId: string): Promise<ProjectPermissions> {
    try {
      // For now, return default permissions
      // In a full implementation, this would check actual Azure DevOps permissions
      return {
        canCreateWorkItems: true,
        canEditWorkItems: true,
        canDeleteWorkItems: true,
        canManageTestPlans: true,
        canExecuteTests: true,
        canViewReports: true
      };
    } catch (error) {
      console.error('Failed to validate permissions:', error);
      // Return minimal permissions on error
      return {
        canCreateWorkItems: false,
        canEditWorkItems: false,
        canDeleteWorkItems: false,
        canManageTestPlans: false,
        canExecuteTests: false,
        canViewReports: false
      };
    }
  }

  async showProjectSelector(): Promise<void> {
    try {
      const projects = await this.getAccessibleProjects();
      
      if (projects.length === 0) {
        vscode.window.showInformationMessage('No accessible projects found in this organization.');
        return;
      }

      const projectItems = projects.map(project => ({
        label: project.name,
        description: project.description,
        detail: `State: ${project.state} | Visibility: ${project.visibility}`,
        project
      }));

      const selected = await vscode.window.showQuickPick(projectItems, {
        placeHolder: 'Select a project to switch to',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        await this.switchProject(selected.project.id);
        vscode.window.showInformationMessage(`Switched to project: ${selected.project.name}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show project selector: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateStatusBar(): void {
    if (this.currentProject) {
      this.statusBarItem.text = `$(organization) ${this.currentProject.name}`;
      this.statusBarItem.tooltip = `Current Azure DevOps Project: ${this.currentProject.name}\nClick to switch projects`;
    } else {
      this.statusBarItem.text = `$(organization) No Project`;
      this.statusBarItem.tooltip = 'No Azure DevOps project selected\nClick to select a project';
    }
    this.statusBarItem.show();
  }

  private mapAzureProjectToProject(azureProject: any): Project {
    return {
      id: azureProject.id,
      name: azureProject.name,
      description: azureProject.description || '',
      url: azureProject.url,
      state: azureProject.state || 'wellFormed',
      visibility: azureProject.visibility || 'private',
      capabilities: {
        versioncontrol: { sourceControlType: 'Git' },
        processTemplate: { templateTypeId: '' }
      },
      processTemplate: {
        id: '',
        name: '',
        workItemTypes: [],
        states: []
      }
    };
  }

  private mapAzureWorkItemTypeToDefinition(azureWit: any): WorkItemTypeDefinition {
    return {
      name: azureWit.name,
      referenceName: azureWit.referenceName,
      description: azureWit.description || '',
      color: azureWit.color || '#000000',
      icon: azureWit.icon || 'icon_clipboard',
      states: azureWit.states?.map((s: any) => s.name) || [],
      fields: azureWit.fields?.map((f: any) => ({
        referenceName: f.referenceName,
        name: f.name,
        type: f.type,
        required: f.required || false,
        readOnly: f.readOnly || false,
        defaultValue: f.defaultValue
      })) || []
    };
  }

  // Event emitter for project changes
  private readonly _onProjectChanged = new vscode.EventEmitter<ProjectContext>();
  public readonly onProjectChanged = this._onProjectChanged.event;

  dispose(): void {
    this.statusBarItem.dispose();
    this._onProjectChanged.dispose();
  }
}