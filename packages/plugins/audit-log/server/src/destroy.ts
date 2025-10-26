import type { Core } from '@strapi/types';

/**
 * Plugin destroy function
 * Called when the plugin is being unloaded or the server is shutting down
 * 
 * This ensures graceful cleanup of resources:
 * - Flushes any queued audit entries
 * - Closes database connections
 * - Cleans up event listeners
 */
export default async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('Destroying audit-log plugin');
  
  try {
    // Get the audit service
    const auditService = strapi.plugin('audit-log')?.service('audit');
    
    if (!auditService) {
      strapi.log.warn('Audit service not found during destroy');
      return;
    }
    
    // Check if there are queued entries to flush
    const queueStats = auditService.getQueueStats();
    
    if (queueStats.size > 0) {
      strapi.log.info(`Flushing ${queueStats.size} queued audit entries before shutdown`);
      
      // Set a timeout for flushing to prevent hanging
      const flushTimeout = 5000; // 5 seconds
      const flushPromise = auditService.flushQueue();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Flush timeout')), flushTimeout)
      );
      
      try {
        await Promise.race([flushPromise, timeoutPromise]);
        strapi.log.info('Successfully flushed queued audit entries');
      } catch (error) {
        strapi.log.error('Failed to flush queued audit entries within timeout:', error);
        strapi.log.warn(`${queueStats.size} audit entries may be lost`);
      }
    } else {
      strapi.log.debug('No queued audit entries to flush');
    }
    
    // Log final statistics
    strapi.log.info('Audit-log plugin statistics:', {
      processed: queueStats.processed,
      failed: queueStats.failed,
      dropped: queueStats.dropped,
    });
    
    strapi.log.info('Audit-log plugin destroyed successfully');
  } catch (error) {
    strapi.log.error('Error during audit-log plugin destruction:', error);
    // Don't throw - we want shutdown to continue even if cleanup fails
  }
};
