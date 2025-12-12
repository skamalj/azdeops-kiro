import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { WorkItem, WorkItemFields, WorkItemType, WorkItemQuery, WorkItemUpdate } from '../types/index.js';

export class AzureDevOpsApiClient {
  private axiosInstance: AxiosInstance;
  private organizationUrl: string = '';
  private projectName: string = '';
  private personalAccessToken: string = '';

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  initialize(organizationUrl: string, projectName: string, pat: string): void {
    this.organizationUrl = organizationUrl.replace(/\/$/, '');
    this.projectName = projectName;
    this.personalAccessToken = pat;

    // Update axios instance with auth
    this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
    this.axiosInstance.defaults.baseURL = `${this.organizationUrl}/${this.projectName}`;
  }

  async createWorkItem(type: WorkItemType, fields: WorkItemFields, parentId?: number): Promise<WorkItem> {
    if (!this.isInitialized()) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    const patchDocument = this.buildPatchDocument(fields, parentId);
    
    try {
      const response: AxiosResponse = await this.axiosInstance.post(
        `/_apis/wit/workitems/$${type}?api-version=7.0`,
        patchDocument,
        {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      return this.mapAzureWorkItemToWorkItem(response.data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create work item');
    }
  }

  async getWorkItem(id: number): Promise<WorkItem> {
    if (!this.isInitialized()) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      const response: AxiosResponse = await this.axiosInstance.get(
        `/_apis/wit/workitems/${id}?api-version=7.0`
      );

      return this.mapAzureWorkItemToWorkItem(response.data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get work item ${id}`);
    }
  }

  async getWorkItems(query: WorkItemQuery): Promise<WorkItem[]> {
    if (!this.isInitialized()) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      // Build WIQL query
      const wiqlQuery = this.buildWiqlQuery(query);
      
      // Execute query to get work item IDs
      const queryResponse: AxiosResponse = await this.axiosInstance.post(
        `/_apis/wit/wiql?api-version=7.0`,
        { query: wiqlQuery },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const workItemIds = queryResponse.data.workItems?.map((wi: any) => wi.id) || [];
      
      if (workItemIds.length === 0) {
        return [];
      }

      // Get work item details
      const idsParam = workItemIds.slice(0, query.maxResults || 50).join(',');
      const detailsResponse: AxiosResponse = await this.axiosInstance.get(
        `/_apis/wit/workitems?ids=${idsParam}&api-version=7.0`
      );

      return detailsResponse.data.value.map((item: any) => this.mapAzureWorkItemToWorkItem(item));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get work items');
    }
  }

  async updateWorkItem(id: number, updates: WorkItemUpdate[]): Promise<WorkItem> {
    if (!this.isInitialized()) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      const response: AxiosResponse = await this.axiosInstance.patch(
        `/_apis/wit/workitems/${id}?api-version=7.0`,
        updates,
        {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      return this.mapAzureWorkItemToWorkItem(response.data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to update work item ${id}`);
    }
  }

  private isInitialized(): boolean {
    return !!(this.organizationUrl && this.projectName && this.personalAccessToken);
  }

  private buildPatchDocument(fields: WorkItemFields, parentId?: number): any[] {
    const patchDocument: any[] = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: fields.title,
      },
    ];

    if (fields.description) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Description',
        value: fields.description,
      });
    }

    if (fields.assignedTo) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: fields.assignedTo,
      });
    }

    if (fields.storyPoints !== undefined) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
        value: fields.storyPoints,
      });
    }

    if (fields.remainingWork !== undefined) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',
        value: fields.remainingWork,
      });
    }

    if (fields.tags && fields.tags.length > 0) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: fields.tags.join(';'),
      });
    }

    if (parentId) {
      patchDocument.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.organizationUrl}/_apis/wit/workItems/${parentId}`,
        },
      });
    }

    return patchDocument;
  }

  private buildWiqlQuery(query: WorkItemQuery): string {
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

    wiql += ' ORDER BY [System.Id] DESC';

    return wiql;
  }

  private mapAzureWorkItemToWorkItem(azureWorkItem: any): WorkItem {
    const fields = azureWorkItem.fields || {};
    
    return {
      id: azureWorkItem.id,
      type: fields['System.WorkItemType'] || 'Unknown',
      title: fields['System.Title'] || '',
      description: fields['System.Description'] || '',
      state: fields['System.State'] || 'New',
      assignedTo: fields['System.AssignedTo']?.displayName || fields['System.AssignedTo'] || undefined,
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || undefined,
      remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || undefined,
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag: string) => tag.trim()).filter((tag: string) => tag) : undefined,
      createdDate: new Date(fields['System.CreatedDate']),
      changedDate: new Date(fields['System.ChangedDate']),
      parentId: this.extractParentId(azureWorkItem.relations),
    };
  }

  private extractParentId(relations: any[]): number | undefined {
    if (!relations) return undefined;
    
    const parentRelation = relations.find(rel => 
      rel.rel === 'System.LinkTypes.Hierarchy-Reverse'
    );
    
    if (parentRelation?.url) {
      const match = parentRelation.url.match(/workItems\/(\d+)$/);
      return match ? parseInt(match[1], 10) : undefined;
    }
    
    return undefined;
  }

  private handleApiError(error: any, message: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;
      
      let errorMessage = `${message}: HTTP ${status} ${statusText}`;
      
      if (responseData?.message) {
        errorMessage += ` - ${responseData.message}`;
      }
      
      return new Error(errorMessage);
    }
    
    return new Error(`${message}: ${error.message || 'Unknown error'}`);
  }
}