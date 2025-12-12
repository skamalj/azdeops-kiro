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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Azure DevOps Core MCP server running on stdio');
  }
}

// Run the server
const server = new AzureDevOpsCoreServer();
server.run().catch(console.error);