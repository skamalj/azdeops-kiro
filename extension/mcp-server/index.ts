#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool schemas
const CreateUserStorySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  storyPoints: z.number().int().min(1).max(21).optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  remainingWork: z.number().min(0).optional(),
  parentId: z.number().int().positive().optional(),
});

const GetWorkItemsSchema = z.object({
  type: z.enum(['User Story', 'Task', 'Bug', 'Feature']).optional(),
  state: z.string().optional(),
  assignedTo: z.string().optional(),
  maxResults: z.number().int().positive().max(200).default(50),
});

const UpdateWorkItemSchema = z.object({
  id: z.number().int().positive(),
  updates: z.array(z.object({
    op: z.enum(['add', 'replace', 'remove']),
    path: z.string(),
    value: z.any().optional(),
  })),
});

const GetWorkItemSchema = z.object({
  id: z.number().int().positive(),
});

const CreateTestCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  steps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    action: z.string(),
    expectedResult: z.string(),
  })),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
  testPlanId: z.number().int().positive().optional(),
});

const CreateTestPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  areaPath: z.string(),
  iterationPath: z.string(),
  projectId: z.string(),
});

const GetProjectsSchema = z.object({
  organizationUrl: z.string().url().optional(),
});

const SwitchProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

const GetScrumMetricsSchema = z.object({
  projectId: z.string().optional(),
});

const GetTestCasesSchema = z.object({
  projectId: z.string().optional(),
  testPlanId: z.number().int().positive().optional(),
  maxResults: z.number().int().positive().max(200).default(50),
});

const GetTestPlansSchema = z.object({
  projectId: z.string().optional(),
});

const ExecuteTestCaseSchema = z.object({
  testCaseId: z.number().int().positive(),
  outcome: z.enum(['Passed', 'Failed', 'Blocked', 'Not Applicable']),
  comment: z.string().optional(),
  executedBy: z.string(),
});

// Sprint management schema
const GetSprintsSchema = z.object({
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  state: z.enum(['current', 'future', 'closed']).optional(),
});

// Batch operation schemas
const BatchCreateUserStoriesSchema = z.object({
  stories: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    storyPoints: z.number().int().min(1).max(21).optional(),
  })),
  batchSize: z.number().int().min(1).max(50).default(10),
});

const BatchCreateTasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    remainingWork: z.number().min(0).optional(),
    parentId: z.number().int().positive().optional(),
  })),
  batchSize: z.number().int().min(1).max(50).default(10),
});

const BatchCreateTestCasesSchema = z.object({
  testCases: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    steps: z.array(z.object({
      stepNumber: z.number().int().positive(),
      action: z.string(),
      expectedResult: z.string(),
    })),
    priority: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
    testPlanId: z.number().int().positive().optional(),
  })),
  batchSize: z.number().int().min(1).max(50).default(10),
});

const BatchCreateTestPlansSchema = z.object({
  testPlans: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    areaPath: z.string(),
    iterationPath: z.string(),
    projectId: z.string(),
  })),
  batchSize: z.number().int().min(1).max(20).default(5),
});

class AzureDevOpsApiClient {
  private organizationUrl: string = '';
  private projectName: string = '';
  private pat: string = '';

  initialize(organizationUrl: string, projectName: string, pat: string) {
    this.organizationUrl = organizationUrl;
    this.projectName = projectName;
    this.pat = pat;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`;
  }

  private getBaseUrl(): string {
    return `${this.organizationUrl}/${this.projectName}`;
  }

  async createWorkItem(type: string, fields: any, parentId?: number): Promise<any> {
    const patchDocument = [
      { op: 'add', path: '/fields/System.Title', value: fields.title },
      { op: 'add', path: '/fields/System.Description', value: fields.description || '' },
    ];

    if (fields.storyPoints) {
      patchDocument.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: fields.storyPoints });
    }

    if (fields.remainingWork) {
      patchDocument.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: fields.remainingWork });
    }

    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/$${type}?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patchDocument)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create work item: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Link to parent if specified
    if (parentId) {
      await this.linkWorkItems(data.id, parentId, 'System.LinkTypes.Hierarchy-Reverse');
    }

    return this.mapAzureWorkItemToWorkItem(data);
  }

  async getWorkItems(query: any = {}): Promise<any[]> {
    let wiql = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${this.projectName}'`;
    
    if (query.type) {
      wiql += ` AND [System.WorkItemType] = '${query.type}'`;
    }
    
    if (query.state) {
      wiql += ` AND [System.State] = '${query.state}'`;
    }
    
    if (query.assignedTo) {
      wiql += ` AND [System.AssignedTo] = '${query.assignedTo}'`;
    }

    const queryResponse = await fetch(
      `${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
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

    const idsParam = workItemIds.slice(0, query.maxResults || 50).join(',');
    const detailsResponse = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&api-version=7.0`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!detailsResponse.ok) {
      throw new Error(`Failed to get work item details: ${detailsResponse.status} ${detailsResponse.statusText}`);
    }

    const detailsData = await detailsResponse.json();
    return detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
  }

  async getWorkItem(id: number): Promise<any> {
    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get work item: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapAzureWorkItemToWorkItem(data);
  }

  async updateWorkItem(id: number, updates: any[]): Promise<any> {
    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(updates)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update work item: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapAzureWorkItemToWorkItem(data);
  }

  private async linkWorkItems(sourceId: number, targetId: number, linkType: string): Promise<void> {
    const linkData = {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: linkType,
        url: `${this.getBaseUrl()}/_apis/wit/workItems/${targetId}`
      }
    };

    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${sourceId}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify([linkData])
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to link work items: ${response.status} ${response.statusText}`);
    }
  }

  async getProjects(): Promise<any[]> {
    const response = await fetch(
      `${this.organizationUrl}/_apis/projects?api-version=7.0`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.value.map((proj: any) => this.mapAzureProjectToProject(proj));
  }

  async createTestCase(fields: any, testPlanId?: number): Promise<any> {
    const patchDocument = this.buildTestCasePatchDocument(fields, testPlanId);
    
    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/$Test%20Case?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patchDocument)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create test case: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapAzureWorkItemToWorkItem(data);
  }

  async createTestPlan(fields: any): Promise<any> {
    const testPlanData = {
      name: fields.name,
      description: fields.description,
      areaPath: fields.areaPath,
      iteration: fields.iterationPath,
      state: 'Active'
    };

    const response = await fetch(
      `${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPlanData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create test plan: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getTestCases(projectId?: string, testPlanId?: number, maxResults = 50): Promise<any[]> {
    let wiql = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.WorkItemType] = 'Test Case'`;
    
    if (projectId) {
      wiql += ` AND [System.TeamProject] = '${projectId}'`;
    } else if (this.projectName) {
      wiql += ` AND [System.TeamProject] = '${this.projectName}'`;
    }
    
    if (testPlanId) {
      wiql += ` AND [Microsoft.VSTS.TCM.TestPlanId] = ${testPlanId}`;
    }

    const queryResponse = await fetch(
      `${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: wiql })
      }
    );

    if (!queryResponse.ok) {
      throw new Error(`Failed to query test cases: ${queryResponse.status} ${queryResponse.statusText}`);
    }

    const queryData = await queryResponse.json();
    const workItemIds = queryData.workItems?.map((wi: any) => wi.id) || [];

    if (workItemIds.length === 0) {
      return [];
    }

    const idsParam = workItemIds.slice(0, maxResults).join(',');
    const detailsResponse = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&$expand=all&api-version=7.0`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!detailsResponse.ok) {
      throw new Error(`Failed to get test case details: ${detailsResponse.status} ${detailsResponse.statusText}`);
    }

    const detailsData = await detailsResponse.json();
    return detailsData.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
  }

  async getTestPlans(projectId?: string): Promise<any[]> {
    const response = await fetch(
      `${this.getBaseUrl()}/_apis/testplan/Plans?api-version=7.0`,
      {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get test plans: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.value;
  }

  async executeTestCase(testCaseId: number, result: any): Promise<any> {
    const patchDocument = [
      {
        op: 'replace',
        path: '/fields/Microsoft.VSTS.TCM.LastResult',
        value: result.outcome
      },
      {
        op: 'replace',
        path: '/fields/Microsoft.VSTS.TCM.LastResultDetails',
        value: result.comment || ''
      },
      {
        op: 'replace',
        path: '/fields/Microsoft.VSTS.TCM.LastRunBy',
        value: result.executedBy
      }
    ];

    const response = await fetch(
      `${this.getBaseUrl()}/_apis/wit/workitems/${testCaseId}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patchDocument)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to execute test case: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapAzureWorkItemToWorkItem(data);
  }

  private buildTestCasePatchDocument(fields: any, testPlanId?: number): any[] {
    const patchDocument = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: fields.title
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: fields.description || ''
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: this.mapPriorityToNumber(fields.priority)
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
        value: 'Not Automated'
      }
    ];

    if (fields.steps && fields.steps.length > 0) {
      const stepsXml = this.buildTestStepsXml(fields.steps);
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.Steps',
        value: stepsXml
      });
    }

    if (testPlanId) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.TestPlanId',
        value: testPlanId
      });
    }

    return patchDocument;
  }

  private buildTestStepsXml(steps: any[]): string {
    let xml = `<steps id="0" last="${steps.length}">`;
    
    steps.forEach(step => {
      xml += `<step id="${step.stepNumber}" type="ActionStep">`;
      xml += `<parameterizedString isformatted="true">${this.escapeXml(step.action)}</parameterizedString>`;
      xml += `<parameterizedString isformatted="true">${this.escapeXml(step.expectedResult)}</parameterizedString>`;
      xml += `<description/>`;
      xml += `</step>`;
    });
    
    xml += '</steps>';
    return xml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private mapPriorityToNumber(priority: string): number {
    switch (priority) {
      case 'Critical': return 1;
      case 'High': return 2;
      case 'Medium': return 3;
      case 'Low': return 4;
      default: return 3;
    }
  }

  private mapAzureProjectToProject(azureProject: any): any {
    return {
      id: azureProject.id,
      name: azureProject.name,
      description: azureProject.description || '',
      url: azureProject.url,
      state: azureProject.state || 'wellFormed',
      visibility: azureProject.visibility || 'private'
    };
  }

  private mapAzureWorkItemToWorkItem(azureWorkItem: any): any {
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

  // Sprint Management Method
  async getSprints(projectId?: string, teamId?: string, state?: string): Promise<any[]> {
    const projectToUse = projectId || this.projectName;
    
    try {
      console.log(`[DEBUG] Getting sprints for project: ${projectToUse}`);
      console.log(`[DEBUG] Organization URL: ${this.organizationUrl}`);
      
      // Approach 1: Try classification nodes API to get iterations
      let url = `${this.organizationUrl}/${projectToUse}/_apis/wit/classificationnodes/iterations?api-version=7.0&$depth=2`;
      console.log(`[DEBUG] Trying classification nodes API: ${url}`);
      
      let response = await fetch(url, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      console.log(`[DEBUG] Classification nodes response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Classification nodes data:', JSON.stringify(data, null, 2));
        
        const iterations: any[] = [];
        
        // Handle nested structure
        if (data.children) {
          data.children.forEach((child: any) => {
            console.log(`[DEBUG] Found child iteration: ${child.name}`);
            iterations.push({
              id: child.id,
              name: child.name,
              path: child.path,
              url: child.url,
              attributes: child.attributes || {},
              hasChildren: child.hasChildren || false,
              structureType: child.structureType
            });
          });
        }
        
        console.log(`[DEBUG] Found ${iterations.length} iterations via classification nodes`);
        return iterations;
      }
      
      // Approach 2: Try team settings API with different team name variations
      const teamVariations = [
        teamId,
        `${projectToUse} Team`,
        projectToUse,
        `${projectToUse}\\${projectToUse} Team`
      ].filter(Boolean);
      
      for (const teamName of teamVariations) {
        try {
          console.log(`[DEBUG] Trying team settings API with team: ${teamName}`);
          
          let teamUrl = `${this.organizationUrl}/${projectToUse}/${teamName}/_apis/work/teamsettings/iterations?api-version=7.0`;
          if (state) {
            teamUrl += `&$timeframe=${state}`;
          }
          
          response = await fetch(teamUrl, {
            headers: {
              'Authorization': this.getAuthHeader(),
              'Content-Type': 'application/json'
            }
          });

          console.log(`[DEBUG] Team settings response for ${teamName}: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[DEBUG] Team settings data for ${teamName}:`, JSON.stringify(data, null, 2));
            return data.value || [];
          }
        } catch (teamError) {
          console.log(`[DEBUG] Team ${teamName} failed:`, teamError);
        }
      }
      
      // Approach 3: Query work items to find iteration paths
      console.log('[DEBUG] Trying work item query approach...');
      
      const wiql = `
        SELECT [System.Id], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.TeamProject] = '${projectToUse}'
        AND [System.IterationPath] <> ''
        AND [System.IterationPath] <> '${projectToUse}'
      `;

      response = await fetch(
        `${this.getBaseUrl()}/_apis/wit/wiql?api-version=7.0`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: wiql })
        }
      );

      console.log(`[DEBUG] WIQL query response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const queryData = await response.json();
        console.log('[DEBUG] WIQL query data:', JSON.stringify(queryData, null, 2));
        
        const iterationPaths = new Set<string>();
        
        if (queryData.workItems && queryData.workItems.length > 0) {
          const workItemIds = queryData.workItems.map((wi: any) => wi.id);
          const idsParam = workItemIds.slice(0, 50).join(',');
          
          const detailsResponse = await fetch(
            `${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsParam}&fields=System.IterationPath&api-version=7.0`,
            {
              headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json'
              }
            }
          );

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            console.log('[DEBUG] Work item details:', JSON.stringify(detailsData, null, 2));
            
            detailsData.value.forEach((item: any) => {
              const iterationPath = item.fields?.['System.IterationPath'];
              if (iterationPath && iterationPath !== projectToUse) {
                console.log(`[DEBUG] Found iteration path: ${iterationPath}`);
                iterationPaths.add(iterationPath);
              }
            });
          }
        }
        
        const sprints = Array.from(iterationPaths).map((path, index) => {
          const pathParts = path.split('\\');
          const name = pathParts[pathParts.length - 1];
          return {
            id: `sprint-${index + 1}`,
            name: name,
            path: path,
            attributes: {},
            hasChildren: false,
            structureType: 'iteration'
          };
        });
        
        console.log(`[DEBUG] Found ${sprints.length} sprints via work item query`);
        return sprints;
      }
      
      console.log('[DEBUG] All approaches failed, returning empty array');
      return [];
      
    } catch (error) {
      console.error('[DEBUG] Error getting sprints:', error);
      return [];
    }
  }
}

export class AzureDevOpsCoreServer {
  private server: Server;
  private apiClient: AzureDevOpsApiClient;

  constructor() {
    this.server = new Server(
      {
        name: 'azure-devops-core',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiClient = new AzureDevOpsApiClient();
    this.initializeFromEnvironment();
    this.setupToolHandlers();
  }

  private initializeFromEnvironment() {
    const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL;
    const projectName = process.env.AZURE_DEVOPS_PROJECT;
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (organizationUrl && projectName && pat) {
      this.apiClient.initialize(organizationUrl, projectName, pat);
    }
  }

  private ensureInitialized() {
    const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL;
    const projectName = process.env.AZURE_DEVOPS_PROJECT;
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (!organizationUrl || !projectName || !pat) {
      throw new Error('Azure DevOps configuration missing. Please set AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PROJECT, and AZURE_DEVOPS_PAT environment variables.');
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_user_story',
            description: 'Create a new user story in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'User story title' },
                description: { type: 'string', description: 'Detailed description' },
                storyPoints: { type: 'number', description: 'Story points (1-21)', minimum: 1, maximum: 21 },
              },
              required: ['title'],
            },
          },
          {
            name: 'create_task',
            description: 'Create a new task in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Detailed description' },
                remainingWork: { type: 'number', description: 'Remaining work in hours', minimum: 0 },
                parentId: { type: 'number', description: 'Parent user story ID (optional)' },
              },
              required: ['title'],
            },
          },
          {
            name: 'get_work_items',
            description: 'Retrieve work items from Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['User Story', 'Task', 'Bug', 'Feature'] },
                state: { type: 'string', description: 'Work item state' },
                assignedTo: { type: 'string', description: 'Assigned user' },
                maxResults: { type: 'number', minimum: 1, maximum: 200, default: 50 },
              },
            },
          },
          {
            name: 'update_work_item',
            description: 'Update an existing work item',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Work item ID' },
                updates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      op: { type: 'string', enum: ['add', 'replace', 'remove'] },
                      path: { type: 'string' },
                      value: {},
                    },
                    required: ['op', 'path'],
                  },
                },
              },
              required: ['id', 'updates'],
            },
          },
          {
            name: 'get_work_item',
            description: 'Get a specific work item by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Work item ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'get_projects',
            description: 'Get accessible projects in the organization',
            inputSchema: {
              type: 'object',
              properties: {
                organizationUrl: { type: 'string', description: 'Organization URL (optional)' },
              },
            },
          },
          {
            name: 'switch_project',
            description: 'Switch to a different project',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID' },
                projectName: { type: 'string', description: 'Project name' },
              },
              required: ['projectId', 'projectName'],
            },
          },
          {
            name: 'create_test_case',
            description: 'Create a new test case',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Test case title' },
                description: { type: 'string', description: 'Test case description' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number' },
                      action: { type: 'string' },
                      expectedResult: { type: 'string' },
                    },
                    required: ['stepNumber', 'action', 'expectedResult'],
                  },
                },
                priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
                testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
              },
              required: ['title', 'steps'],
            },
          },
          {
            name: 'create_test_plan',
            description: 'Create a new test plan',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Test plan name' },
                description: { type: 'string', description: 'Test plan description' },
                areaPath: { type: 'string', description: 'Area path' },
                iterationPath: { type: 'string', description: 'Iteration path' },
                projectId: { type: 'string', description: 'Project ID' },
              },
              required: ['name', 'areaPath', 'iterationPath', 'projectId'],
            },
          },
          {
            name: 'get_test_cases',
            description: 'Get test cases',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID (optional)' },
                testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
                maxResults: { type: 'number', minimum: 1, maximum: 200, default: 50 },
              },
            },
          },
          {
            name: 'get_test_plans',
            description: 'Get test plans',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID (optional)' },
              },
            },
          },
          {
            name: 'execute_test_case',
            description: 'Execute a test case and record results',
            inputSchema: {
              type: 'object',
              properties: {
                testCaseId: { type: 'number', description: 'Test case ID' },
                outcome: { type: 'string', enum: ['Passed', 'Failed', 'Blocked', 'Not Applicable'] },
                comment: { type: 'string', description: 'Execution comment (optional)' },
                executedBy: { type: 'string', description: 'Person who executed the test' },
              },
              required: ['testCaseId', 'outcome', 'executedBy'],
            },
          },
          {
            name: 'batch_create_user_stories',
            description: 'Create multiple user stories in batches',
            inputSchema: {
              type: 'object',
              properties: {
                stories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'User story title' },
                      description: { type: 'string', description: 'Detailed description' },
                      storyPoints: { type: 'number', description: 'Story points (1-21)', minimum: 1, maximum: 21 },
                    },
                    required: ['title'],
                  },
                },
                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
              },
              required: ['stories'],
            },
          },
          {
            name: 'batch_create_tasks',
            description: 'Create multiple tasks in batches',
            inputSchema: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Task title' },
                      description: { type: 'string', description: 'Detailed description' },
                      remainingWork: { type: 'number', description: 'Remaining work in hours', minimum: 0 },
                      parentId: { type: 'number', description: 'Parent work item ID (optional)' },
                    },
                    required: ['title'],
                  },
                },
                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
              },
              required: ['tasks'],
            },
          },
          {
            name: 'batch_create_test_cases',
            description: 'Create multiple test cases in batches',
            inputSchema: {
              type: 'object',
              properties: {
                testCases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Test case title' },
                      description: { type: 'string', description: 'Test case description' },
                      steps: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            stepNumber: { type: 'number' },
                            action: { type: 'string' },
                            expectedResult: { type: 'string' },
                          },
                          required: ['stepNumber', 'action', 'expectedResult'],
                        },
                      },
                      priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
                      testPlanId: { type: 'number', description: 'Test plan ID (optional)' },
                    },
                    required: ['title', 'steps'],
                  },
                },
                batchSize: { type: 'number', description: 'Batch size (1-50)', minimum: 1, maximum: 50, default: 10 },
              },
              required: ['testCases'],
            },
          },
          {
            name: 'batch_create_test_plans',
            description: 'Create multiple test plans in batches',
            inputSchema: {
              type: 'object',
              properties: {
                testPlans: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Test plan name' },
                      description: { type: 'string', description: 'Test plan description' },
                      areaPath: { type: 'string', description: 'Area path' },
                      iterationPath: { type: 'string', description: 'Iteration path' },
                      projectId: { type: 'string', description: 'Project ID' },
                    },
                    required: ['name', 'areaPath', 'iterationPath', 'projectId'],
                  },
                },
                batchSize: { type: 'number', description: 'Batch size (1-20)', minimum: 1, maximum: 20, default: 5 },
              },
              required: ['testPlans'],
            },
          },
          {
            name: 'get_sprints',
            description: 'Get all sprints/iterations',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID (optional)' },
                teamId: { type: 'string', description: 'Team ID (optional)' },
                state: { type: 'string', enum: ['current', 'future', 'closed'], description: 'Sprint state filter' },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_user_story':
            return await this.createUserStory(args);
          case 'create_task':
            return await this.createTask(args);
          case 'get_work_items':
            return await this.getWorkItems(args);
          case 'update_work_item':
            return await this.updateWorkItem(args);
          case 'get_work_item':
            return await this.getWorkItem(args);
          case 'get_projects':
            return await this.getProjects(args);
          case 'switch_project':
            return await this.switchProject(args);
          case 'create_test_case':
            return await this.createTestCase(args);
          case 'create_test_plan':
            return await this.createTestPlan(args);
          case 'get_test_cases':
            return await this.getTestCases(args);
          case 'get_test_plans':
            return await this.getTestPlans(args);
          case 'execute_test_case':
            return await this.executeTestCase(args);
          case 'batch_create_user_stories':
            return await this.batchCreateUserStories(args);
          case 'batch_create_tasks':
            return await this.batchCreateTasks(args);
          case 'batch_create_test_cases':
            return await this.batchCreateTestCases(args);
          case 'batch_create_test_plans':
            return await this.batchCreateTestPlans(args);
          case 'get_sprints':
            return await this.getSprints(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async createUserStory(args: any) {
    this.ensureInitialized();
    const { title, description, storyPoints } = CreateUserStorySchema.parse(args);
    
    const fields = { title, description: description || '', storyPoints };
    const workItem = await this.apiClient.createWorkItem('User Story', fields);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created User Story #${workItem.id}: ${workItem.title}\n\nDetails:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- State: ${workItem.state}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Description: ${workItem.description || 'No description'}`,
        },
      ],
    };
  }

  private async createTask(args: any) {
    this.ensureInitialized();
    const { title, description, remainingWork, parentId } = CreateTaskSchema.parse(args);
    
    const fields = { title, description: description || '', remainingWork };
    const workItem = await this.apiClient.createWorkItem('Task', fields, parentId);
    
    const parentInfo = parentId ? `\n- Parent: User Story #${parentId}` : '\n- Type: Independent task';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created Task #${workItem.id}: ${workItem.title}\n\nDetails:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- State: ${workItem.state}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours${parentInfo}\n- Description: ${workItem.description || 'No description'}`,
        },
      ],
    };
  }

  private async getWorkItems(args: any) {
    this.ensureInitialized();
    const query = GetWorkItemsSchema.parse(args);
    
    const workItems = await this.apiClient.getWorkItems(query);
    
    if (workItems.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No work items found matching the specified criteria.',
          },
        ],
      };
    }

    const workItemsList = workItems.map(item => 
      `- #${item.id}: ${item.title} (${item.type}, ${item.state}${item.assignedTo ? `, assigned to ${item.assignedTo}` : ''})`
    ).join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${workItems.length} work item(s):\n\n${workItemsList}`,
        },
      ],
    };
  }

  private async updateWorkItem(args: any) {
    this.ensureInitialized();
    const { id, updates } = UpdateWorkItemSchema.parse(args);
    
    const workItem = await this.apiClient.updateWorkItem(id, updates);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Updated Work Item #${workItem.id}: ${workItem.title}\n\nCurrent Details:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}`,
        },
      ],
    };
  }

  private async getWorkItem(args: any) {
    this.ensureInitialized();
    const { id } = GetWorkItemSchema.parse(args);
    
    const workItem = await this.apiClient.getWorkItem(id);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Work Item #${workItem.id}: ${workItem.title}\n\nDetails:\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}\n- Created: ${workItem.createdDate.toLocaleDateString()}\n- Modified: ${workItem.changedDate.toLocaleDateString()}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours\n- Tags: ${workItem.tags?.join(', ') || 'None'}\n\nDescription:\n${workItem.description || 'No description'}`,
        },
      ],
    };
  }

  private async getProjects(args: any) {
    this.ensureInitialized();
    const projects = await this.apiClient.getProjects();
    
    if (projects.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No accessible projects found in this organization.',
          },
        ],
      };
    }

    const projectsList = projects.map(project => 
      `- ${project.name} (${project.id}) - ${project.state} | ${project.visibility}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${projects.length} accessible project(s):\n\n${projectsList}`,
        },
      ],
    };
  }

  private async switchProject(args: any) {
    this.ensureInitialized();
    const { projectId, projectName } = SwitchProjectSchema.parse(args);
    
    // Update the API client with new project
    this.apiClient.initialize(
      process.env.AZURE_DEVOPS_ORG_URL!,
      projectName,
      process.env.AZURE_DEVOPS_PAT!
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Switched to project: ${projectName} (${projectId})\n\nYou can now create and manage work items in this project.`,
        },
      ],
    };
  }

  private async createTestCase(args: any) {
    this.ensureInitialized();
    const { title, description, steps, priority, testPlanId } = CreateTestCaseSchema.parse(args);
    
    const fields = { title, description: description || '', steps, priority };
    const testCase = await this.apiClient.createTestCase(fields, testPlanId);
    
    const testPlanInfo = testPlanId ? `\n- Test Plan: #${testPlanId}` : '\n- Type: Independent test case';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created Test Case #${testCase.id}: ${testCase.title}\n\nDetails:\n- ID: ${testCase.id}\n- Title: ${testCase.title}\n- State: ${testCase.state}\n- Priority: ${priority}\n- Steps: ${steps.length}${testPlanInfo}\n- Description: ${testCase.description || 'No description'}`,
        },
      ],
    };
  }

  private async createTestPlan(args: any) {
    this.ensureInitialized();
    const { name, description, areaPath, iterationPath, projectId } = CreateTestPlanSchema.parse(args);
    
    const fields = { name, description: description || '', areaPath, iterationPath };
    const testPlan = await this.apiClient.createTestPlan(fields);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created Test Plan #${testPlan.id}: ${testPlan.name}\n\nDetails:\n- ID: ${testPlan.id}\n- Name: ${testPlan.name}\n- Project: ${projectId}\n- Area Path: ${areaPath}\n- Iteration Path: ${iterationPath}\n- State: ${testPlan.state}\n- Description: ${testPlan.description || 'No description'}`,
        },
      ],
    };
  }

  private async getTestCases(args: any) {
    this.ensureInitialized();
    const { projectId, testPlanId, maxResults } = GetTestCasesSchema.parse(args);
    
    const testCases = await this.apiClient.getTestCases(projectId, testPlanId, maxResults);
    
    if (testCases.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No test cases found matching the specified criteria.',
          },
        ],
      };
    }

    const testCasesList = testCases.map(testCase => 
      `- #${testCase.id}: ${testCase.title} (${testCase.state}${testCase.assignedTo ? `, assigned to ${testCase.assignedTo}` : ''})`
    ).join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${testCases.length} test case(s):\n\n${testCasesList}`,
        },
      ],
    };
  }

  private async getTestPlans(args: any) {
    this.ensureInitialized();
    const { projectId } = GetTestPlansSchema.parse(args);
    
    const testPlans = await this.apiClient.getTestPlans(projectId);
    
    if (testPlans.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No test plans found in the specified project.',
          },
        ],
      };
    }

    const testPlansList = testPlans.map(testPlan => 
      `- #${testPlan.id}: ${testPlan.name} (${testPlan.state})`
    ).join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${testPlans.length} test plan(s):\n\n${testPlansList}`,
        },
      ],
    };
  }

  private async executeTestCase(args: any) {
    this.ensureInitialized();
    const { testCaseId, outcome, comment, executedBy } = ExecuteTestCaseSchema.parse(args);
    
    const result = { outcome, comment, executedBy };
    const testCase = await this.apiClient.executeTestCase(testCaseId, result);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Test Case #${testCaseId} executed successfully\n\nExecution Details:\n- Test Case: #${testCase.id} - ${testCase.title}\n- Outcome: ${outcome}\n- Executed By: ${executedBy}\n- Comment: ${comment || 'No comment'}\n- Execution Date: ${new Date().toLocaleDateString()}`,
        },
      ],
    };
  }

  private async batchCreateUserStories(args: any) {
    this.ensureInitialized();
    const { stories, batchSize } = BatchCreateUserStoriesSchema.parse(args);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < stories.length; i += batchSize) {
      const batch = stories.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stories.length / batchSize)} (${batch.length} user stories)`);
      
      const batchPromises = batch.map(async (story, index) => {
        try {
          const result = await this.apiClient.createWorkItem("User Story", story);
          return { index: i + index, success: true, result, story: story.title };
        } catch (error) {
          return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', story: story.title };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
      
      // Rate limiting: wait between batches
      if (i + batchSize < stories.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.length;
    const errorCount = errors.length;
    const successList = results.map(r => `- #${r.result.id}: ${r.story}`).join('\n');
    const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.story}: ${e.error}`).join('\n')}` : '';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Batch User Story Creation Complete\n\nSummary:\n- Total requested: ${stories.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated User Stories:\n${successList}${errorList}`,
        },
      ],
    };
  }

  private async batchCreateTasks(args: any) {
    this.ensureInitialized();
    const { tasks, batchSize } = BatchCreateTasksSchema.parse(args);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)} (${batch.length} tasks)`);
      
      const batchPromises = batch.map(async (task, index) => {
        try {
          const result = await this.apiClient.createWorkItem("Task", task, task.parentId);
          return { index: i + index, success: true, result, task: task.title };
        } catch (error) {
          return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', task: task.title };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
      
      // Rate limiting: wait between batches
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.length;
    const errorCount = errors.length;
    const successList = results.map(r => `- #${r.result.id}: ${r.task}${r.result.parentId ? ` (parent: #${r.result.parentId})` : ''}`).join('\n');
    const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.task}: ${e.error}`).join('\n')}` : '';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Batch Task Creation Complete\n\nSummary:\n- Total requested: ${tasks.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Tasks:\n${successList}${errorList}`,
        },
      ],
    };
  }

  private async batchCreateTestCases(args: any) {
    this.ensureInitialized();
    const { testCases, batchSize } = BatchCreateTestCasesSchema.parse(args);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < testCases.length; i += batchSize) {
      const batch = testCases.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testCases.length / batchSize)} (${batch.length} test cases)`);
      
      const batchPromises = batch.map(async (testCase, index) => {
        try {
          const result = await this.apiClient.createTestCase(testCase, testCase.testPlanId);
          return { index: i + index, success: true, result, testCase: testCase.title };
        } catch (error) {
          return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testCase: testCase.title };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
      
      // Rate limiting: wait between batches
      if (i + batchSize < testCases.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.length;
    const errorCount = errors.length;
    const successList = results.map(r => `- #${r.result.id}: ${r.testCase}`).join('\n');
    const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.testCase}: ${e.error}`).join('\n')}` : '';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Batch Test Case Creation Complete\n\nSummary:\n- Total requested: ${testCases.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Test Cases:\n${successList}${errorList}`,
        },
      ],
    };
  }

  private async batchCreateTestPlans(args: any) {
    this.ensureInitialized();
    const { testPlans, batchSize } = BatchCreateTestPlansSchema.parse(args);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < testPlans.length; i += batchSize) {
      const batch = testPlans.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testPlans.length / batchSize)} (${batch.length} test plans)`);
      
      const batchPromises = batch.map(async (testPlan, index) => {
        try {
          const result = await this.apiClient.createTestPlan(testPlan);
          return { index: i + index, success: true, result, testPlan: testPlan.name };
        } catch (error) {
          return { index: i + index, success: false, error: error instanceof Error ? error.message : 'Unknown error', testPlan: testPlan.name };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
      
      // Rate limiting: wait between batches
      if (i + batchSize < testPlans.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.length;
    const errorCount = errors.length;
    const successList = results.map(r => `- #${r.result.id}: ${r.testPlan}`).join('\n');
    const errorList = errors.length > 0 ? `\n\nErrors:\n${errors.map(e => `- ${e.testPlan}: ${e.error}`).join('\n')}` : '';
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Batch Test Plan Creation Complete\n\nSummary:\n- Total requested: ${testPlans.length}\n- Successfully created: ${successCount}\n- Errors: ${errorCount}\n\nCreated Test Plans:\n${successList}${errorList}`,
        },
      ],
    };
  }

  private async getSprints(args: any) {
    this.ensureInitialized();
    const { projectId, teamId, state } = GetSprintsSchema.parse(args);
    
    const sprints = await this.apiClient.getSprints(projectId, teamId, state);
    
    const sprintList = sprints.map(sprint => 
      `- ${sprint.name} (${sprint.id}): ${sprint.path || 'No path'} [${sprint.structureType || 'unknown'}]`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${sprints.length} sprint(s):\n\n${sprintList || 'No sprints found.'}\n\n[DEBUG] Check console for detailed debug information.`
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Azure DevOps Core MCP server running on stdio');
  }
}

// Run the server
const server = new AzureDevOpsCoreServer();
server.run().catch(console.error);