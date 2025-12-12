// Shared types for Azure DevOps Integration
// Used by both the VS Code extension and Kiro Power

export interface WorkItem {
  id: number;
  type: 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Test Case' | 'Info';
  title: string;
  description: string;
  state: string;
  assignedTo?: string;
  storyPoints?: number;
  remainingWork?: number;
  parentId?: number;
  tags?: string[];
  createdDate: Date;
  changedDate: Date;
  fields?: Record<string, any>;
}

export interface AuthCredentials {
  organizationUrl: string;
  projectName: string;
  authType: 'PAT' | 'OAuth';
  token?: string;
  refreshToken?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface WorkItemQuery {
  projectId?: string;
  assignedTo?: string;
  state?: string;
  type?: string;
  tags?: string[];
  searchText?: string;
  maxResults?: number;
}

export interface WorkItemFields {
  title: string;
  description?: string;
  assignedTo?: string;
  storyPoints?: number;
  remainingWork?: number;
  tags?: string[];
  [key: string]: any;
}

export interface WorkItemUpdate {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: any;
}

export type WorkItemType = 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Test Case' | 'Info';

// MCP-specific types for the power
export interface MCPToolRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}