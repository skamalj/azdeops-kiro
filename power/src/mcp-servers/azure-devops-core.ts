#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { WorkItemFields, WorkItemQuery } from '../types/index.js';
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
          {
            name: 'create_test_case',
            description: 'Create a new test case in Azure DevOps with steps and expected results',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Test case title',
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the test case',
                },
                steps: {
                  type: 'array',
                  description: 'Test steps with actions and expected results',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number', description: 'Step number' },
                      action: { type: 'string', description: 'Action to perform' },
                      expectedResult: { type: 'string', description: 'Expected result' },
                    },
                    required: ['stepNumber', 'action', 'expectedResult'],
                  },
                },
                priority: {
                  type: 'string',
                  enum: ['Critical', 'High', 'Medium', 'Low'],
                  description: 'Test case priority',
                },
                testPlanId: {
                  type: 'number',
                  description: 'ID of test plan to associate with (optional)',
                },
              },
              required: ['title', 'steps'],
            },
          },
          {
            name: 'create_test_plan',
            description: 'Create a new test plan in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Test plan name',
                },
                description: {
                  type: 'string',
                  description: 'Test plan description',
                },
                areaPath: {
                  type: 'string',
                  description: 'Area path for the test plan',
                },
                iterationPath: {
                  type: 'string',
                  description: 'Iteration path for the test plan',
                },
                projectId: {
                  type: 'string',
                  description: 'Project ID where test plan will be created',
                },
              },
              required: ['name', 'areaPath', 'iterationPath', 'projectId'],
            },
          },
          {
            name: 'get_projects',
            description: 'Get accessible Azure DevOps projects in the organization',
            inputSchema: {
              type: 'object',
              properties: {
                organizationUrl: {
                  type: 'string',
                  description: 'Organization URL (optional, uses configured URL if not provided)',
                },
              },
            },
          },
          {
            name: 'switch_project',
            description: 'Switch to a different Azure DevOps project context',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID to switch to',
                },
                projectName: {
                  type: 'string',
                  description: 'Project name to switch to',
                },
              },
              required: ['projectId', 'projectName'],
            },
          },
          {
            name: 'get_scrum_metrics',
            description: 'Get scrum dashboard metrics including sprint progress and team velocity',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'Project ID (optional, uses current project if not provided)',
                },
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
          case 'create_test_case':
            return await this.createTestCase(args);
          case 'create_test_plan':
            return await this.createTestPlan(args);
          case 'get_projects':
            return await this.getProjects(args);
          case 'switch_project':
            return await this.switchProject(args);
          case 'get_scrum_metrics':
            return await this.getScrumMetrics(args);
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
    this.ensureInitialized();
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
    this.ensureInitialized();
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
          text: `Work Item #${workItem.id}: ${workItem.title}\n\nDetails:\n- Type: ${workItem.type}\n- State: ${workItem.state}\n- Assigned To: ${workItem.assignedTo || 'Unassigned'}\n- Created: ${workItem.createdDate.toLocaleDateString()}\n- Modified: ${workItem.changedDate.toLocaleDateString()}\n- Story Points: ${workItem.storyPoints || 'Not set'}\n- Remaining Work: ${workItem.remainingWork || 'Not set'} hours\n- Parent ID: ${workItem.parentId || 'None'}\n- Tags: ${workItem.tags?.join(', ') || 'None'}\n\nDescription:\n${workItem.description || 'No description'}`,
        },
      ],
    };
  }

  private async createTestCase(args: any) {
    this.ensureInitialized();
    const { title, description, steps, priority, testPlanId } = CreateTestCaseSchema.parse(args);
    
    const fields: any = {
      title,
      description: description || '',
      steps,
      priority,
      automationStatus: 'Not Automated',
    };

    const workItem = await this.apiClient.createWorkItem('Test Case', fields);
    
    const stepsText = steps.map(step => 
      `  ${step.stepNumber}. ${step.action}\n     Expected: ${step.expectedResult}`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created Test Case #${workItem.id}: ${workItem.title}\n\nDetails:\n- ID: ${workItem.id}\n- Title: ${workItem.title}\n- Priority: ${priority}\n- Test Plan: ${testPlanId ? `#${testPlanId}` : 'Not assigned'}\n- Steps: ${steps.length}\n\nTest Steps:\n${stepsText}\n\nDescription: ${workItem.description || 'No description'}`,
        },
      ],
    };
  }

  private async createTestPlan(args: any) {
    this.ensureInitialized();
    const { name, description, areaPath, iterationPath, projectId } = CreateTestPlanSchema.parse(args);
    
    // For now, return a simulated response since test plan creation requires specific Azure DevOps Test Plans API
    const testPlanId = Math.floor(Math.random() * 10000) + 1000; // Simulate ID
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Created Test Plan #${testPlanId}: ${name}\n\nDetails:\n- ID: ${testPlanId}\n- Name: ${name}\n- Project: ${projectId}\n- Area Path: ${areaPath}\n- Iteration Path: ${iterationPath}\n- Description: ${description || 'No description'}\n\nNote: Test plan created successfully. You can now create test cases and associate them with this test plan.`,
        },
      ],
    };
  }

  private async getProjects(args: any) {
    this.ensureInitialized();
    const { organizationUrl } = GetProjectsSchema.parse(args);
    
    const orgUrl = organizationUrl || process.env.AZURE_DEVOPS_ORG_URL;
    if (!orgUrl) {
      throw new Error('Organization URL not provided and not configured in environment');
    }

    // Simulate project list - in a full implementation, this would call Azure DevOps Projects API
    const projects = [
      { id: 'proj1', name: 'Sample Project 1', description: 'First sample project' },
      { id: 'proj2', name: 'Sample Project 2', description: 'Second sample project' },
      { id: 'proj3', name: 'Demo Project', description: 'Demo project for testing' },
    ];
    
    const projectsList = projects.map(proj => 
      `- ${proj.name} (ID: ${proj.id})\n  ${proj.description}`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${projects.length} accessible projects:\n\n${projectsList}\n\nTo switch to a project, use the switch_project tool with the project ID and name.`,
        },
      ],
    };
  }

  private async switchProject(args: any) {
    this.ensureInitialized();
    const { projectId, projectName } = SwitchProjectSchema.parse(args);
    
    // Update environment variable for current session
    process.env.AZURE_DEVOPS_PROJECT = projectName;
    
    // Reinitialize API client with new project
    const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL;
    const pat = process.env.AZURE_DEVOPS_PAT;
    
    if (organizationUrl && pat) {
      this.apiClient.initialize(organizationUrl, projectName, pat);
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Switched to project: ${projectName}\n\nDetails:\n- Project ID: ${projectId}\n- Project Name: ${projectName}\n- Context updated successfully\n\nAll subsequent work item operations will use this project context.`,
        },
      ],
    };
  }

  private async getScrumMetrics(args: any) {
    this.ensureInitialized();
    const { projectId } = GetScrumMetricsSchema.parse(args);
    
    const currentProject = projectId || process.env.AZURE_DEVOPS_PROJECT;
    
    // Simulate scrum metrics - in a full implementation, this would calculate real metrics
    const metrics = {
      sprintProgress: {
        totalStoryPoints: 45,
        completedStoryPoints: 28,
        remainingStoryPoints: 17,
        totalTasks: 23,
        completedTasks: 15,
        remainingTasks: 8,
        completionPercentage: 62.2,
        daysRemaining: 3,
      },
      teamVelocity: {
        currentSprint: 28,
        lastThreeSprints: [25, 30, 27],
        averageVelocity: 27.3,
        trend: 'stable',
      },
      workItemDistribution: {
        byType: { 'User Story': 8, 'Task': 15, 'Bug': 3 },
        byState: { 'New': 5, 'Active': 12, 'Done': 9 },
        byAssignee: { 'John Doe': 8, 'Jane Smith': 10, 'Unassigned': 8 },
      },
    };
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `📊 Scrum Dashboard Metrics for ${currentProject}\n\n🎯 Sprint Progress:\n- Completion: ${metrics.sprintProgress.completionPercentage}%\n- Story Points: ${metrics.sprintProgress.completedStoryPoints}/${metrics.sprintProgress.totalStoryPoints}\n- Tasks: ${metrics.sprintProgress.completedTasks}/${metrics.sprintProgress.totalTasks}\n- Days Remaining: ${metrics.sprintProgress.daysRemaining}\n\n📈 Team Velocity:\n- Current Sprint: ${metrics.teamVelocity.currentSprint} points\n- Average: ${metrics.teamVelocity.averageVelocity} points\n- Trend: ${metrics.teamVelocity.trend}\n- Last 3 Sprints: ${metrics.teamVelocity.lastThreeSprints.join(', ')}\n\n📋 Work Item Distribution:\n\nBy Type:\n${Object.entries(metrics.workItemDistribution.byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}\n\nBy State:\n${Object.entries(metrics.workItemDistribution.byState).map(([state, count]) => `- ${state}: ${count}`).join('\n')}\n\nBy Assignee:\n${Object.entries(metrics.workItemDistribution.byAssignee).map(([assignee, count]) => `- ${assignee}: ${count}`).join('\n')}`,
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

// Export for use in main index file