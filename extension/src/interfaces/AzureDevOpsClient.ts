import { AuthCredentials, AuthResult, WorkItem, WorkItemQuery, WorkItemType, WorkItemFields, WorkItemUpdate } from '../types';

/**
 * Primary interface for all Azure DevOps API operations
 */
export interface AzureDevOpsClient {
  /**
   * Authenticate with Azure DevOps using provided credentials
   */
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;

  /**
   * Retrieve work items based on query parameters
   */
  getWorkItems(query: WorkItemQuery): Promise<WorkItem[]>;

  /**
   * Create a new work item in Azure DevOps
   */
  createWorkItem(type: WorkItemType, fields: WorkItemFields, parentId?: number): Promise<WorkItem>;

  /**
   * Update an existing work item
   */
  updateWorkItem(id: number, updates: WorkItemUpdate[]): Promise<WorkItem>;

  /**
   * Link two work items with specified relationship type
   */
  linkWorkItems(sourceId: number, targetId: number, linkType: string): Promise<void>;

  /**
   * Get a specific work item by ID
   */
  getWorkItem(id: number): Promise<WorkItem>;

  /**
   * Delete a work item
   */
  deleteWorkItem(id: number): Promise<void>;

  /**
   * Check if the client is authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Check if the client is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Check if the client is ready for API calls (authenticated and initialized)
   */
  isReady(): boolean;

  /**
   * Get current authentication status
   */
  getAuthStatus(): AuthResult | null;
}