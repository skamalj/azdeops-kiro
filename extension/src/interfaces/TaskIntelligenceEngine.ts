import { WorkItem, TaskAnalysis, CompletionResult, ProgressUpdate } from '../types';

/**
 * Analyzes and executes task completion workflows
 */
export interface TaskIntelligenceEngine {
  /**
   * Analyze a task to determine required actions and deliverables
   */
  analyzeTask(task: WorkItem): Promise<TaskAnalysis>;

  /**
   * Execute task completion based on analysis
   */
  executeTaskCompletion(task: WorkItem, analysis: TaskAnalysis): Promise<CompletionResult>;

  /**
   * Update task progress in Azure DevOps
   */
  updateTaskProgress(taskId: number, progress: ProgressUpdate): Promise<void>;

  /**
   * Determine if a task can be automatically completed
   */
  canAutoComplete(task: WorkItem): Promise<boolean>;

  /**
   * Get suggested actions for a task
   */
  getSuggestedActions(task: WorkItem): Promise<string[]>;
}