#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { WorkItem, WorkItemFields, WorkItemUpdate, WorkItemQuery } from '../../../shared/types/index.js';
import { AzureDevOpsApiClient } from '../services/AzureDevOpsApiClient.js';

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

class AzureDevOpsCoreServer {
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
    this.setupToolHandlers();
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
                title: {
                  type: 'string',
                  description: 'User story title (e.g., "As a user, I want to...")',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the user story',
                },
                storyPoints: {
                  type: 'number',
                  description: 'Story points (1, 2, 3, 5, 8, 13, 21)',
                  minimum: 1,
                  maximum: 21,
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'create_task',
            description: 'Create a new task in Azure DevOps (independent or linked to a user story)',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Task title',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the task',
                },
                remainingWork: {
                  type: 'number',
                  description: 'Estimated remaining work in hours',
                  minimum: 0,
                },
                parentId: {
                  type: 'number',
                  description: 'ID of parent user story (optional for independent tasks)',
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'get_work_items',
            description: 'Retrieve work items from Azure DevOps with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['User Story', 'Task', 'Bug', 'Feature'],
                  description: 'Filter by work item type',
                },
                state: {
                  type: 'string',
                  description: 'Filter by work item state (e.g., "Active", "New", "Done")',
                },
                assignedTo: {
                  type: 'string',
                  description: 'Filter by assigned user',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 50, max: 200)',
                  minimum: 1,
                  maximum: 200,
                },
              },
            },
          },
          {
            name: 'update_work_item',
            description: 'Update an existing work item in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID to update',
                },
                updates: {
                  type: 'array',
                  description: 'Array of update operations',
                  items: {
                    type: 'object',
                    properties: {
                      op: {
                        type: 'string',
                        enum: ['add', 'replace', 'remove'],
                        description: 'Operation type',
                      },
                      path: {
                        type: 'string',
                        description: 'Field path (e.g., "/fields/System.Title")',
                      },
                      value: {
                        description: 'New value for the field',
                      },
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
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
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
    const { title, description, storyPoints } = CreateUserStorySchema.parse(args);
    
    const fields: WorkItemFields = {
      title,
      description: description || '',
      storyPoints,
    };

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
    const { title, description, remainingWork, parentId } = CreateTaskSchema.parse(args);
    
    const fields: WorkItemFields = {
      title,
      description: description || '',
      remainingWork,
    };

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
    const { type, state, assignedTo, maxResults } = GetWorkItemsSchema.parse(args);
    
    const query: WorkItemQuery = {
      type,
      state,
      assignedTo,
      maxResults,
    };

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
    const { id } = GetWorkItemSchema.parse(args);
    
    const workItem = await this.apiClient.getWorkItem(id);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Work Item #${workItem.id}: ${workItem.title}\n\nDetails:\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}\n- Created: ${workItem.createdDate.toLocaleDateString()}\n- Modified: ${workItem.changedDate.toLocaleDateString()}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours\n- Parent ID: ${workItem.parentId || 'None'}\n- Tags: ${workItem.tags?.join(', ') || 'None'}\n\nDescription:\n${workItem.description || 'No description'}`,
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

const server = new AzureDevOpsCoreServer();
server.run().catch(console.error);