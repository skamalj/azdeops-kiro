// Core data models for Azure DevOps Integration

export interface WorkItem {
  id: number;
  type: 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Info';
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

export interface TaskAnalysis {
  taskType: 'code' | 'test' | 'bug-fix' | 'documentation' | 'research';
  requiredActions: Action[];
  estimatedEffort: number;
  dependencies: number[];
  deliverables: Deliverable[];
}

export interface Action {
  type: 'create-file' | 'modify-file' | 'run-test' | 'commit-code';
  description: string;
  target?: string;
  parameters?: Record<string, any>;
}

export interface Deliverable {
  type: 'code' | 'test' | 'documentation' | 'artifact';
  path: string;
  description: string;
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

export interface CacheQuery {
  type?: string;
  assignedTo?: string;
  state?: string;
  lastModified?: Date;
}

export interface SyncResult {
  success: boolean;
  itemsUpdated: number;
  conflicts: DataConflict[];
  error?: string;
}

export interface DataConflict {
  workItemId: number;
  field: string;
  localValue: any;
  remoteValue: any;
  timestamp: Date;
}

export interface ConflictResolution {
  workItemId: number;
  field: string;
  resolvedValue: any;
  strategy: 'local' | 'remote' | 'merge';
}

export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  workItemId?: number;
  data: any;
  timestamp: Date;
  retryCount: number;
}

export interface ProgressUpdate {
  remainingWork?: number;
  completedWork?: number;
  state?: string;
  comments?: string;
}

export interface CompletionResult {
  success: boolean;
  workItemId: number;
  deliverables: Deliverable[];
  error?: string;
}

export type WorkItemType = 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Info';