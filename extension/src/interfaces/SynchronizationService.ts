import { SyncResult, OfflineOperation, DataConflict, ConflictResolution } from '../types';

/**
 * Manages data consistency and offline operations
 */
export interface SynchronizationService {
  /**
   * Synchronize work items with Azure DevOps
   */
  syncWorkItems(): Promise<SyncResult>;

  /**
   * Queue an operation for offline execution
   */
  queueOfflineOperation(operation: OfflineOperation): void;

  /**
   * Resolve conflicts between local and remote data
   */
  resolveConflicts(conflicts: DataConflict[]): Promise<ConflictResolution[]>;

  /**
   * Check if the service is online
   */
  isOnline(): boolean;

  /**
   * Get pending offline operations
   */
  getPendingOperations(): OfflineOperation[];

  /**
   * Process queued operations when connectivity is restored
   */
  processQueuedOperations(): Promise<void>;
}