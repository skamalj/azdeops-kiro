// Core data models for Azure DevOps Integration

export interface WorkItem {
  id: number;
  type: string; // Changed to string to support any work item type (Epic, Issue, User Story, Task, Bug, etc.)
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
  projectId: string;
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

export type WorkItemType = 'User Story' | 'Task' | 'Bug' | 'Feature' | 'Test Case' | 'Info';

// Project-related interfaces
export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  state: 'wellFormed' | 'createPending' | 'deleting' | 'new';
  visibility: 'private' | 'public';
  capabilities: ProjectCapabilities;
  processTemplate: ProcessTemplate;
}

export interface ProjectCapabilities {
  versioncontrol: { sourceControlType: 'Git' | 'Tfvc' };
  processTemplate: { templateTypeId: string };
}

export interface ProcessTemplate {
  id: string;
  name: string;
  workItemTypes: WorkItemTypeDefinition[];
  states: StateDefinition[];
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

export interface StateDefinition {
  name: string;
  color: string;
  category: 'Proposed' | 'InProgress' | 'Resolved' | 'Completed' | 'Removed';
}

export interface FieldDefinition {
  referenceName: string;
  name: string;
  type: 'String' | 'Integer' | 'Double' | 'DateTime' | 'Boolean' | 'Identity' | 'PicklistString';
  required: boolean;
  readOnly: boolean;
  defaultValue?: any;
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

// Scrum dashboard interfaces
export interface ScrumMetrics {
  sprintProgress: SprintProgress;
  teamVelocity: TeamVelocity;
  burndownData: BurndownData;
  workItemDistribution: WorkItemDistribution;
}

export interface SprintProgress {
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  daysRemaining: number;
  completionPercentage: number;
  measurementType?: string;
  measurementUnit?: string;
  totalEffort?: number;
  completedEffort?: number;
}

export interface TeamVelocity {
  currentSprint: number;
  lastThreeSprints: number[];
  averageVelocity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface BurndownData {
  dates: string[];
  idealBurndown: number[];
  actualBurndown: number[];
  remainingWork: number[];
}

export interface WorkItemDistribution {
  byType: { [key: string]: number };
  byState: { [key: string]: number };
  byAssignee: { [key: string]: number };
}