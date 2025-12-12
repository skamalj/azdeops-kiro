import { 
  AuthCredentials, 
  AuthResult, 
  WorkItem, 
  WorkItemQuery, 
  WorkItemType, 
  WorkItemFields, 
  WorkItemUpdate 
} from '../types';
import { AzureDevOpsClient } from '../interfaces';
import { AuthenticationService } from './AuthenticationService';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

/**
 * Request queue item
 */
interface QueuedRequest {
  url: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
}

/**
 * Azure DevOps REST API client with rate limiting and retry logic
 */
export class AzureDevOpsApiClient implements AzureDevOpsClient {
  private authService: AuthenticationService;
  private baseUrl: string = '';
  private projectName: string = '';
  private requestQueue: QueuedRequest[] = [];
  private requestTimes: number[] = [];
  private isProcessingQueue: boolean = false;
  
  // Rate limiting configuration
  private rateLimitConfig: RateLimitConfig = {
    maxRequests: 200, // Azure DevOps allows 200 requests per minute
    windowMs: 60 * 1000, // 1 minute window
    retryAfterMs: 1000 // Wait 1 second before retry
  };

  constructor(authService: AuthenticationService) {
    this.authService = authService;
  }

  /**
   * Initialize the client with organization and project information
   */
  initialize(organizationUrl: string, projectName: string): void {
    this.baseUrl = organizationUrl;
    this.projectName = projectName;
  }

  /**
   * Authenticate with Azure DevOps
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const result = await this.authService.authenticate(credentials);
    
    if (result.success) {
      this.initialize(credentials.organizationUrl, credentials.projectName);
    }
    
    return result;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Check if client is properly initialized with base URL and project
   */
  isInitialized(): boolean {
    return this.baseUrl !== '' && this.projectName !== '';
  }

  /**
   * Check if client is ready for API calls (authenticated and initialized)
   */
  isReady(): boolean {
    return this.isAuthenticated() && this.isInitialized();
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): AuthResult | null {
    return this.authService.getAuthResult();
  }

  /**
   * Get work items based on query
   */
  async getWorkItems(query: WorkItemQuery): Promise<WorkItem[]> {
    if (!this.isReady()) {
      if (!this.isAuthenticated()) {
        throw new Error('Not authenticated with Azure DevOps');
      }
      if (!this.isInitialized()) {
        throw new Error('API client not initialized. Please connect to Azure DevOps first.');
      }
    }

    // Build WIQL query
    const wiqlQuery = this.buildWiqlQuery(query);
    
    // Execute query to get work item IDs
    const queryResult = await this.executeWiqlQuery(wiqlQuery);
    
    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      return [];
    }

    // Get detailed work item information
    const workItemIds = queryResult.workItems.map((wi: any) => wi.id);
    return this.getWorkItemDetails(workItemIds);
  }

  /**
   * Get a specific work item by ID
   */
  async getWorkItem(id: number): Promise<WorkItem> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    const url = `${this.baseUrl}/_apis/wit/workitems/${id}?$expand=all&api-version=7.0`;
    const response = await this.makeRequest(url);
    
    return this.mapAzureDevOpsWorkItem(response);
  }

  /**
   * Create a new work item
   */
  async createWorkItem(type: WorkItemType, fields: WorkItemFields, parentId?: number): Promise<WorkItem> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    const url = `${this.baseUrl}/${this.projectName}/_apis/wit/workitems/$${type}?api-version=7.0`;
    
    // Build patch document for work item creation
    const patchDocument = this.buildPatchDocument(fields);
    
    // Add parent link if parentId is provided
    if (parentId) {
      patchDocument.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.baseUrl}/_apis/wit/workItems/${parentId}`
        }
      });
    }
    
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify(patchDocument)
    };

    const response = await this.makeRequest(url, options);
    return this.mapAzureDevOpsWorkItem(response);
  }

  /**
   * Update an existing work item
   */
  async updateWorkItem(id: number, updates: WorkItemUpdate[]): Promise<WorkItem> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    const url = `${this.baseUrl}/_apis/wit/workitems/${id}?api-version=7.0`;
    
    const options: RequestInit = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify(updates)
    };

    const response = await this.makeRequest(url, options);
    return this.mapAzureDevOpsWorkItem(response);
  }

  /**
   * Link two work items
   */
  async linkWorkItems(sourceId: number, targetId: number, linkType: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    const url = `${this.baseUrl}/_apis/wit/workitems/${sourceId}?api-version=7.0`;
    
    const linkUpdate: WorkItemUpdate = {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: linkType,
        url: `${this.baseUrl}/_apis/wit/workItems/${targetId}`,
        attributes: {
          comment: 'Linked via Kiro Azure DevOps Integration'
        }
      }
    };

    const options: RequestInit = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify([linkUpdate])
    };

    await this.makeRequest(url, options);
  }

  /**
   * Delete a work item
   */
  async deleteWorkItem(id: number): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure DevOps');
    }

    const url = `${this.baseUrl}/_apis/wit/workitems/${id}?api-version=7.0`;
    
    const options: RequestInit = {
      method: 'DELETE'
    };

    await this.makeRequest(url, options);
  }

  /**
   * Make HTTP request with rate limiting and retry logic
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        url,
        options: {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': this.authService.getAuthHeader() || '',
            'Accept': 'application/json'
          }
        },
        resolve,
        reject,
        retryCount: 0
      };

      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check rate limit
      if (!this.canMakeRequest()) {
        await this.waitForRateLimit();
        continue;
      }

      const request = this.requestQueue.shift()!;
      
      try {
        const response = await this.executeRequest(request);
        request.resolve(response);
        this.recordRequestTime();
      } catch (error) {
        await this.handleRequestError(request, error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest(request: QueuedRequest): Promise<any> {
    const response = await fetch(request.url, request.options);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimitConfig.retryAfterMs;
      
      throw new Error(`Rate limited. Retry after ${waitTime}ms`);
    }

    // Handle authentication errors
    if (response.status === 401) {
      // Try to refresh token
      const refreshResult = await this.authService.refreshToken();
      if (refreshResult.success) {
        // Update auth header and retry
        request.options.headers = {
          ...request.options.headers,
          'Authorization': this.authService.getAuthHeader() || ''
        };
        throw new Error('Authentication refreshed, retry request');
      } else {
        throw new Error('Authentication failed. Please re-authenticate.');
      }
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Handle request errors with retry logic
   */
  private async handleRequestError(request: QueuedRequest, error: any): Promise<void> {
    const maxRetries = 3;
    const isRetryableError = error.message.includes('Rate limited') || 
                           error.message.includes('Authentication refreshed') ||
                           error.message.includes('Network error');

    if (request.retryCount < maxRetries && isRetryableError) {
      request.retryCount++;
      
      // Exponential backoff
      const backoffTime = Math.pow(2, request.retryCount) * 1000;
      
      setTimeout(() => {
        this.requestQueue.unshift(request); // Add back to front of queue
        this.processQueue();
      }, backoffTime);
    } else {
      request.reject(error);
    }
  }

  /**
   * Check if we can make a request within rate limits
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;
    
    // Remove old request times
    this.requestTimes = this.requestTimes.filter(time => time > windowStart);
    
    return this.requestTimes.length < this.rateLimitConfig.maxRequests;
  }

  /**
   * Wait for rate limit window to reset
   */
  private async waitForRateLimit(): Promise<void> {
    const oldestRequest = Math.min(...this.requestTimes);
    const waitTime = oldestRequest + this.rateLimitConfig.windowMs - Date.now();
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Record the time of a successful request
   */
  private recordRequestTime(): void {
    this.requestTimes.push(Date.now());
  }

  /**
   * Build WIQL query from WorkItemQuery
   */
  private buildWiqlQuery(query: WorkItemQuery): string {
    let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.projectName}'`;

    if (query.type) {
      wiql += ` AND [System.WorkItemType] = '${query.type}'`;
    }

    if (query.assignedTo) {
      wiql += ` AND [System.AssignedTo] = '${query.assignedTo}'`;
    }

    if (query.state) {
      wiql += ` AND [System.State] = '${query.state}'`;
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(tag => `[System.Tags] CONTAINS '${tag}'`).join(' OR ');
      wiql += ` AND (${tagConditions})`;
    }

    if (query.searchText) {
      wiql += ` AND ([System.Title] CONTAINS '${query.searchText}' OR [System.Description] CONTAINS '${query.searchText}')`;
    }

    wiql += ' ORDER BY [System.Id] DESC';

    return wiql;
  }

  /**
   * Execute WIQL query
   */
  private async executeWiqlQuery(wiql: string): Promise<any> {
    const url = `${this.baseUrl}/${this.projectName}/_apis/wit/wiql?api-version=7.0`;
    
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: wiql })
    };

    return this.makeRequest(url, options);
  }

  /**
   * Get detailed work item information for multiple IDs
   */
  private async getWorkItemDetails(ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];

    const batchSize = 200; // Azure DevOps limit
    const workItems: WorkItem[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const idsParam = batchIds.join(',');
      
      const url = `${this.baseUrl}/_apis/wit/workitems?ids=${idsParam}&$expand=all&api-version=7.0`;
      const response = await this.makeRequest(url);
      
      if (response.value) {
        const mappedItems = response.value.map((item: any) => this.mapAzureDevOpsWorkItem(item));
        workItems.push(...mappedItems);
      }
    }

    return workItems;
  }

  /**
   * Map Azure DevOps work item to our WorkItem interface
   */
  private mapAzureDevOpsWorkItem(azureWorkItem: any): WorkItem {
    const fields = azureWorkItem.fields || {};
    
    return {
      id: azureWorkItem.id,
      type: fields['System.WorkItemType'] || 'Task',
      title: fields['System.Title'] || '',
      description: fields['System.Description'] || '',
      state: fields['System.State'] || '',
      assignedTo: fields['System.AssignedTo']?.displayName,
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'],
      remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'],
      parentId: fields['System.Parent'],
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : [],
      createdDate: new Date(fields['System.CreatedDate']),
      changedDate: new Date(fields['System.ChangedDate']),
      fields: fields
    };
  }

  /**
   * Build patch document for work item creation/update
   */
  private buildPatchDocument(fields: WorkItemFields): any[] {
    const patchDocument: any[] = [];

    if (fields.title) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Title',
        value: fields.title
      });
    }

    if (fields.description) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Description',
        value: fields.description
      });
    }

    if (fields.assignedTo) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: fields.assignedTo
      });
    }

    if (fields.storyPoints !== undefined) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
        value: fields.storyPoints
      });
    }

    if (fields.remainingWork !== undefined) {
      patchDocument.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',
        value: fields.remainingWork
      });
    }

    if (fields.tags && fields.tags.length > 0) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: fields.tags.join(';')
      });
    }

    // Add any additional fields
    Object.entries(fields).forEach(([key, value]) => {
      if (!['title', 'description', 'assignedTo', 'storyPoints', 'remainingWork', 'tags'].includes(key)) {
        patchDocument.push({
          op: 'add',
          path: `/fields/${key}`,
          value: value
        });
      }
    });

    return patchDocument;
  }
}