import { WorkItem, CacheQuery } from '../types';

/**
 * Local storage and caching for work items
 */
export interface WorkItemCache {
  /**
   * Store work items in local cache
   */
  store(workItems: WorkItem[]): Promise<void>;

  /**
   * Retrieve work items from cache based on query
   */
  retrieve(query: CacheQuery): Promise<WorkItem[]>;

  /**
   * Invalidate cached work items by IDs
   */
  invalidate(workItemIds: number[]): Promise<void>;

  /**
   * Get the timestamp of last synchronization
   */
  getLastSync(): Promise<Date>;

  /**
   * Clear all cached data
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{ itemCount: number; lastSync: Date; cacheSize: number }>;
}