/**
 * Fallback Queue System for High-Load Scenarios
 * Queues audit entries when database is unavailable or under heavy load
 */

import type { CreateAuditEntryParams } from '../types';

export interface QueueConfig {
  maxSize: number;           // Maximum queue size
  flushInterval: number;     // Interval to attempt flushing queue (ms)
  batchSize: number;         // Number of items to process per flush
}

export interface QueueStats {
  size: number;
  processed: number;
  failed: number;
  dropped: number;
}

/**
 * In-memory queue for audit entries
 * Used as fallback when database operations fail
 */
export class AuditQueue {
  private queue: CreateAuditEntryParams[] = [];
  private config: QueueConfig;
  private stats: QueueStats = {
    size: 0,
    processed: 0,
    failed: 0,
    dropped: 0,
  };
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private processor: ((params: CreateAuditEntryParams) => Promise<void>) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 10000,
      flushInterval: config.flushInterval || 30000, // 30 seconds
      batchSize: config.batchSize || 100,
    };
  }

  /**
   * Add an audit entry to the queue
   */
  enqueue(params: CreateAuditEntryParams): boolean {
    // Check if queue is full
    if (this.queue.length >= this.config.maxSize) {
      this.stats.dropped++;
      return false;
    }

    this.queue.push(params);
    this.stats.size = this.queue.length;
    return true;
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      ...this.stats,
      size: this.queue.length,
    };
  }

  /**
   * Set the processor function for queue items
   */
  setProcessor(processor: (params: CreateAuditEntryParams) => Promise<void>): void {
    this.processor = processor;
  }

  /**
   * Start automatic queue flushing
   */
  startAutoFlush(logger?: any): void {
    if (this.flushTimer) {
      return; // Already started
    }

    this.flushTimer = setInterval(async () => {
      if (this.queue.length > 0) {
        if (logger) {
          logger.debug(`Auto-flushing queue with ${this.queue.length} items`);
        }
        await this.flush(logger);
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic queue flushing
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush the queue by processing items
   */
  async flush(logger?: any): Promise<void> {
    if (this.isProcessing) {
      if (logger) {
        logger.debug('Queue flush already in progress, skipping');
      }
      return;
    }

    if (!this.processor) {
      if (logger) {
        logger.warn('No processor set for queue, cannot flush');
      }
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process items in batches
      const batchSize = Math.min(this.config.batchSize, this.queue.length);
      const batch = this.queue.splice(0, batchSize);

      if (logger) {
        logger.debug(`Processing batch of ${batch.length} audit entries from queue`);
      }

      // Process each item in the batch
      const results = await Promise.allSettled(
        batch.map(params => this.processor!(params))
      );

      // Count successes and failures
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          this.stats.processed++;
        } else {
          failureCount++;
          this.stats.failed++;
          
          // Re-queue failed items if there's space
          if (this.queue.length < this.config.maxSize) {
            this.queue.push(batch[index]);
          } else {
            this.stats.dropped++;
          }

          if (logger) {
            logger.error(`Failed to process queued audit entry: ${result.reason}`);
          }
        }
      });

      if (logger) {
        logger.debug(
          `Queue flush completed: ${successCount} succeeded, ${failureCount} failed, ${this.queue.length} remaining`
        );
      }

      this.stats.size = this.queue.length;
    } catch (error) {
      if (logger) {
        logger.error('Error during queue flush:', error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const droppedCount = this.queue.length;
    this.queue = [];
    this.stats.dropped += droppedCount;
    this.stats.size = 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      size: this.queue.length,
      processed: 0,
      failed: 0,
      dropped: 0,
    };
  }

  /**
   * Cleanup and stop all operations
   */
  destroy(): void {
    this.stopAutoFlush();
    this.clear();
    this.processor = null;
  }
}
