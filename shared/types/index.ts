// Shared types for Azure DevOps Integration
// Used by both the VS Code extension and Kiro Power

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

export type WorkItemType = 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Info';

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

// Project-related interfaces
export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  state: 'wellFormed' | 'createPending' | 'deleting' | 'new';
  visibility: 'private' | 'public';
}

export interface ProjectContext {
  project: Project;
  workItemTypes: WorkItemTypeDefinition[];
  permissions: ProjectPermissions;
}

export interface ProjectPermissions {
  canCreateWorkItems: boolean;
  canEditWorkItems: boolean;
  canDeleteWorkItems: boolean;
  canManageTestPlans: boolean;
  canExecuteTests: boolean;
  canViewReports: boolean;
}

export interface WorkItemTypeDefinition {
  name: string;
  referenceName: string;
  description: string;
  color: string;
  icon: string;
  states: string[];
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  referenceName: string;
  name: string;
  type: 'String' | 'Integer' | 'Double' | 'DateTime' | 'Boolean' | 'Identity' | 'PicklistString';
  required: boolean;
  readOnly: boolean;
  defaultValue?: any;
}

// Test case related interfaces
export interface TestCase extends WorkItem {
  type: 'Test Case';
  steps: TestStep[];
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  testPlanId?: number;
  testSuiteId?: number;
  automationStatus: 'Automated' | 'Not Automated' | 'Planned';
}

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestResult {
  outcome: 'Passed' | 'Failed' | 'Blocked' | 'Not Applicable';
  comment?: string;
  executedBy: string;
  executedDate: Date;
}

export interface TestPlan {
  id: number;
  name: string;
  description: string;
  projectId: string;
  iterationPath: string;
  areaPath: string;
  state: 'Inactive' | 'Active' | 'Completed';
  testSuites: TestSuite[];
  createdDate: Date;
  changedDate: Date;
}

export interface TestSuite {
  id: number;
  name: string;
  testPlanId: number;
  parentSuiteId?: number;
  testCases: TestCase[];
  childSuites: TestSuite[];
}

export interface TestCaseFields extends WorkItemFields {
  steps: TestStep[];
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  automationStatus: 'Automated' | 'Not Automated' | 'Planned';
}

export interface TestPlanFields {
  name: string;
  description: string;
  iterationPath: string;
  areaPath: string;
}