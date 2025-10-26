import type { Core } from '@strapi/types';
import type { 
  AuditService, 
  CreateAuditEntryParams, 
  AuditLogFilters, 
  PaginatedAuditLogs,
  AuditLogConfig,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  AuditMetadata,
  AuditLogEntry
} from '../types';
import { CircuitBreaker, CircuitState } from '../utils/circuit-breaker';
import { retryWithBackoff } from '../utils/retry';
import { AuditQueue } from '../utils/queue';
import { createAuditLogger, AuditLogger } from '../utils/logger';

// Module-level instances for circuit breaker, queue, and logger
let circuitBreaker: CircuitBreaker | null = null;
let auditQueue: AuditQueue | null = null;
let auditLogger: AuditLogger | null = null;

/**
 * Initialize reliability features
 */
function initializeReliabilityFeatures(strapi: Core.Strapi): void {
  // Initialize logger
  if (!auditLogger) {
    auditLogger = createAuditLogger(strapi.log);
    auditLogger.info('Audit logger initialized');
  }

  if (!circuitBreaker) {
    const config = getConfig(strapi);
    
    // Initialize circuit breaker
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 60000, // 1 minute
    });

    auditLogger.info('Circuit breaker initialized', {
      failureThreshold: 5,
      resetTimeout: 60000,
    });
  }

  if (!auditQueue) {
    const config = getConfig(strapi);
    
    // Initialize fallback queue
    auditQueue = new AuditQueue({
      maxSize: 10000,
      flushInterval: 30000, // 30 seconds
      batchSize: config.batchSize || 100,
    });

    // Set processor for queue items
    auditQueue.setProcessor(async (params: CreateAuditEntryParams) => {
      await createAuditEntryDirect(strapi, params);
    });

    // Start auto-flush
    auditQueue.startAutoFlush(strapi.log);

    auditLogger.info('Fallback queue initialized', {
      maxSize: 10000,
      flushInterval: 30000,
      batchSize: config.batchSize || 100,
    });
  }
}

/**
 * Get circuit breaker instance
 */
function getCircuitBreaker(strapi: Core.Strapi): CircuitBreaker {
  if (!circuitBreaker) {
    initializeReliabilityFeatures(strapi);
  }
  return circuitBreaker!;
}

/**
 * Get audit queue instance
 */
function getAuditQueue(strapi: Core.Strapi): AuditQueue {
  if (!auditQueue) {
    initializeReliabilityFeatures(strapi);
  }
  return auditQueue!;
}

/**
 * Direct database write for audit entry (used by retry logic and queue processor)
 */
async function createAuditEntryDirect(
  strapi: Core.Strapi,
  params: CreateAuditEntryParams
): Promise<void> {
  const auditData = {
    contentType: params.contentType,
    recordId: String(params.recordId),
    action: params.action,
    timestamp: new Date(),
    userId: params.userId || null,
    userEmail: params.userEmail || null,
    payload: buildPayload(params.action, params.payload),
    metadata: params.metadata || {},
  };

  await strapi.db.query('plugin::audit-log.audit-log').create({
    data: auditData,
  });
}

/**
 * Build WHERE clause for database query based on filters
 */
function buildWhereClause(filters: AuditLogFilters): any {
  const where: any = {};

  // Filter by content type
  if (filters.contentType) {
    where.contentType = filters.contentType;
  }

  // Filter by user ID
  if (filters.userId !== undefined) {
    where.userId = filters.userId;
  }

  // Filter by action type
  if (filters.action) {
    where.action = filters.action;
  }

  // Filter by date range
  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    
    if (filters.startDate) {
      where.timestamp.$gte = filters.startDate;
    }
    
    if (filters.endDate) {
      where.timestamp.$lte = filters.endDate;
    }
  }

  return where;
}

/**
 * Build ORDER BY clause for database query
 */
function buildOrderBy(sort: 'asc' | 'desc'): any {
  return {
    timestamp: sort,
  };
}

/**
 * Parse date string into Date object
 * Supports ISO 8601 format and common date formats
 */
function parseDate(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Audit service implementation
 * Handles audit log creation and retrieval with reliability features
 */
export default ({ strapi }: { strapi: Core.Strapi }): AuditService => ({
  /**
   * Create a new audit log entry with circuit breaker, retry logic, and fallback queue
   * This is the core method for logging content operations
   */
  async createAuditEntry(params: CreateAuditEntryParams): Promise<void> {
    const logger = auditLogger || createAuditLogger(strapi.log);
    
    try {
      // Validate required parameters
      if (!params.contentType || !params.recordId || !params.action) {
        logger.error('Invalid audit entry parameters', {
          contentType: params.contentType,
          recordId: params.recordId,
          action: params.action,
        });
        return;
      }

      logger.logOperationStart('createAuditEntry', {
        contentType: params.contentType,
        recordId: params.recordId,
        action: params.action,
      });

      // Get circuit breaker and queue instances
      const breaker = getCircuitBreaker(strapi);
      const queue = getAuditQueue(strapi);

      // Check circuit breaker state
      if (!breaker.isEnabled()) {
        const state = breaker.getState();
        logger.warn(`Circuit breaker is ${state}, queueing audit entry`, {
          contentType: params.contentType,
          recordId: params.recordId,
          circuitState: state,
        });

        // Queue the entry for later processing
        const queued = queue.enqueue(params);
        if (!queued) {
          const stats = queue.getStats();
          logger.error('Failed to queue audit entry: queue is full', {
            queueSize: stats.size,
            dropped: stats.dropped,
          });
        } else {
          logger.logQueueOperation('enqueued', queue.size(), {
            contentType: params.contentType,
            recordId: params.recordId,
          });
        }
        return;
      }

      // Attempt to create audit entry with retry logic
      const result = await retryWithBackoff(
        async () => {
          await createAuditEntryDirect(strapi, params);
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
        },
        strapi.log
      );

      if (result.success) {
        // Record success with circuit breaker
        breaker.recordSuccess();
        
        logger.logOperationSuccess('createAuditEntry', {
          contentType: params.contentType,
          recordId: params.recordId,
          action: params.action,
          attempts: result.attempts,
        });
      } else {
        // Record failure with circuit breaker
        const oldState = breaker.getState();
        breaker.recordFailure();
        const newState = breaker.getState();
        
        if (oldState !== newState) {
          logger.logCircuitBreakerStateChange(oldState, newState, {
            failureCount: breaker.getFailureCount(),
          });
        }
        
        logger.logOperationFailure('createAuditEntry', result.error!, {
          attempts: result.attempts,
          contentType: params.contentType,
          recordId: params.recordId,
        });

        // Queue the entry for later processing
        const queued = queue.enqueue(params);
        if (queued) {
          logger.logQueueOperation('enqueued after failure', queue.size(), {
            contentType: params.contentType,
            recordId: params.recordId,
          });
        } else {
          const stats = queue.getStats();
          logger.error('Failed to queue audit entry: queue is full', {
            queueSize: stats.size,
            dropped: stats.dropped,
          });
        }
      }
    } catch (error) {
      // Catch-all error handler - audit logging should never block content operations
      logger.error('Unexpected error in audit logging', {
        error: (error as Error).message,
        contentType: params.contentType,
        recordId: params.recordId,
      });
      
      // Try to queue the entry as last resort
      try {
        const queue = getAuditQueue(strapi);
        const queued = queue.enqueue(params);
        if (queued) {
          logger.info('Audit entry queued as fallback after unexpected error');
        }
      } catch (queueError) {
        logger.error('Failed to queue audit entry as fallback', {
          error: (queueError as Error).message,
        });
      }
    }
  },

  /**
   * Find audit logs with filtering and pagination
   */
  async findAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    const logger = auditLogger || createAuditLogger(strapi.log);
    
    try {
      logger.info('Finding audit logs with filters', {
        contentType: filters.contentType,
        userId: filters.userId,
        action: filters.action,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: filters.page,
        pageSize: filters.pageSize,
        sort: filters.sort,
      });

      // Build query filters
      const where = buildWhereClause(filters);
      
      // Calculate pagination
      const page = filters.page || 1;
      const pageSize = Math.min(filters.pageSize || 25, 100); // Max 100 items per page
      const start = (page - 1) * pageSize;

      // Build sort order
      const orderBy = buildOrderBy(filters.sort || 'desc');

      // Execute query with pagination
      const [data, total] = await Promise.all([
        strapi.db.query('plugin::audit-log.audit-log').findMany({
          where,
          orderBy,
          limit: pageSize,
          offset: start,
        }),
        strapi.db.query('plugin::audit-log.audit-log').count({
          where,
        }),
      ]);

      // Calculate page count
      const pageCount = Math.ceil(total / pageSize);

      logger.info('Audit logs retrieved successfully', {
        total,
        page,
        pageSize,
        pageCount,
        resultsCount: data.length,
      });

      return {
        data: data as AuditLogEntry[],
        pagination: {
          page,
          pageSize,
          pageCount,
          total,
        },
      };
    } catch (error) {
      logger.error('Failed to retrieve audit logs', {
        error: (error as Error).message,
        filters,
      });
      throw error;
    }
  },

  /**
   * Check if auditing is enabled globally
   * Reads from plugin configuration
   */
  isAuditingEnabled(): boolean {
    const config = getConfig(strapi);
    return config.enabled;
  },

  /**
   * Check if a content type is excluded from auditing
   * Reads from plugin configuration's excludeContentTypes array
   */
  isContentTypeExcluded(contentType: string): boolean {
    const config = getConfig(strapi);
    const excludeList = config.excludeContentTypes;
    
    // Check if the content type is in the exclusion list
    return excludeList.some((excluded: string) => excluded === contentType);
  },

  /**
   * Parse and validate query filters
   */
  parseFilters(query: any): AuditLogFilters {
    const logger = auditLogger || createAuditLogger(strapi.log);
    const filters: AuditLogFilters = {};

    // Parse and validate contentType
    if (query.contentType) {
      if (typeof query.contentType === 'string' && query.contentType.trim()) {
        filters.contentType = query.contentType.trim();
      } else {
        logger.warn('Invalid contentType filter, ignoring', { contentType: query.contentType });
      }
    }

    // Parse and validate userId
    if (query.userId !== undefined && query.userId !== null && query.userId !== '') {
      const userId = parseInt(query.userId, 10);
      if (!isNaN(userId) && userId > 0) {
        filters.userId = userId;
      } else {
        logger.warn('Invalid userId filter, ignoring', { userId: query.userId });
      }
    }

    // Parse and validate action
    if (query.action) {
      const validActions = ['create', 'update', 'delete'];
      if (typeof query.action === 'string' && validActions.includes(query.action)) {
        filters.action = query.action;
      } else {
        logger.warn('Invalid action filter, ignoring', { action: query.action });
      }
    }

    // Parse and validate startDate
    if (query.startDate) {
      const startDate = parseDate(query.startDate);
      if (startDate) {
        filters.startDate = startDate;
      } else {
        logger.warn('Invalid startDate filter, ignoring', { startDate: query.startDate });
      }
    }

    // Parse and validate endDate
    if (query.endDate) {
      const endDate = parseDate(query.endDate);
      if (endDate) {
        filters.endDate = endDate;
      } else {
        logger.warn('Invalid endDate filter, ignoring', { endDate: query.endDate });
      }
    }

    // Validate date range
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      logger.warn('startDate is after endDate, swapping dates', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      [filters.startDate, filters.endDate] = [filters.endDate, filters.startDate];
    }

    // Parse and validate page
    if (query.page !== undefined && query.page !== null && query.page !== '') {
      const page = parseInt(query.page, 10);
      if (!isNaN(page) && page > 0) {
        filters.page = page;
      } else {
        logger.warn('Invalid page filter, using default', { page: query.page });
        filters.page = 1;
      }
    } else {
      filters.page = 1;
    }

    // Parse and validate pageSize
    if (query.pageSize !== undefined && query.pageSize !== null && query.pageSize !== '') {
      const pageSize = parseInt(query.pageSize, 10);
      if (!isNaN(pageSize) && pageSize > 0 && pageSize <= 100) {
        filters.pageSize = pageSize;
      } else if (!isNaN(pageSize) && pageSize > 100) {
        logger.warn('pageSize exceeds maximum, using 100', { pageSize: query.pageSize });
        filters.pageSize = 100;
      } else {
        logger.warn('Invalid pageSize filter, using default', { pageSize: query.pageSize });
        filters.pageSize = 25;
      }
    } else {
      filters.pageSize = 25;
    }

    // Parse and validate sort
    if (query.sort) {
      if (query.sort === 'asc' || query.sort === 'desc') {
        filters.sort = query.sort;
      } else {
        logger.warn('Invalid sort filter, using default', { sort: query.sort });
        filters.sort = 'desc';
      }
    } else {
      filters.sort = 'desc';
    }

    logger.debug('Parsed filters', filters);
    return filters;
  },

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): {
    state: CircuitState;
    failureCount: number;
  } {
    const breaker = getCircuitBreaker(strapi);
    return {
      state: breaker.getState(),
      failureCount: breaker.getFailureCount(),
    };
  },

  /**
   * Get queue statistics for monitoring
   */
  getQueueStats() {
    const queue = getAuditQueue(strapi);
    return queue.getStats();
  },

  /**
   * Manually flush the queue
   */
  async flushQueue(): Promise<void> {
    const queue = getAuditQueue(strapi);
    await queue.flush(strapi.log);
  },

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  resetCircuitBreaker(): void {
    const breaker = getCircuitBreaker(strapi);
    breaker.reset();
    strapi.log.info('Circuit breaker has been reset');
  },
});

/**
 * Get and validate plugin configuration
 * Returns default values if configuration is missing or invalid
 */
function getConfig(strapi: Core.Strapi): AuditLogConfig {
  const pluginConfig = strapi.plugin('audit-log').config as Partial<AuditLogConfig> | undefined;
  
  // Provide default configuration values
  const defaultConfig: AuditLogConfig = {
    enabled: true,
    excludeContentTypes: [],
    retentionDays: 365,
    batchSize: 100,
    asyncProcessing: true,
  };

  // Merge with provided configuration
  const config: AuditLogConfig = {
    enabled: pluginConfig?.enabled ?? defaultConfig.enabled,
    excludeContentTypes: Array.isArray(pluginConfig?.excludeContentTypes) 
      ? pluginConfig.excludeContentTypes 
      : defaultConfig.excludeContentTypes,
    retentionDays: pluginConfig?.retentionDays ?? defaultConfig.retentionDays,
    batchSize: pluginConfig?.batchSize ?? defaultConfig.batchSize,
    asyncProcessing: pluginConfig?.asyncProcessing ?? defaultConfig.asyncProcessing,
  };

  // Validate configuration
  if (typeof config.enabled !== 'boolean') {
    strapi.log.warn('Invalid audit log config: enabled must be boolean, using default');
    config.enabled = defaultConfig.enabled;
  }

  if (!Array.isArray(config.excludeContentTypes)) {
    strapi.log.warn('Invalid audit log config: excludeContentTypes must be array, using default');
    config.excludeContentTypes = defaultConfig.excludeContentTypes;
  }

  return config;
}

/**
 * Build payload structure based on action type
 * Different action types have different payload structures
 */
function buildPayload(
  action: 'create' | 'update' | 'delete',
  data: any
): CreatePayload | UpdatePayload | DeletePayload {
  switch (action) {
    case 'create':
      return buildCreatePayload(data);
    case 'update':
      return buildUpdatePayload(data);
    case 'delete':
      return buildDeletePayload(data);
    default:
      throw new Error(`Unknown action type: ${action}`);
  }
}

/**
 * Build payload for create action
 * Stores the complete data of the created record
 */
function buildCreatePayload(data: any): CreatePayload {
  return {
    type: 'create',
    data: sanitizeData(data),
  };
}

/**
 * Build payload for update action
 * Stores the before/after values for changed fields
 */
function buildUpdatePayload(data: any): UpdatePayload {
  const { before, after } = data || {};
  
  if (!before || !after) {
    // If we don't have before/after data, store what we have
    return {
      type: 'update',
      changes: {},
      updatedFields: [],
    };
  }

  const changes: Record<string, { from: any; to: any }> = {};
  const updatedFields: string[] = [];

  // Compare before and after to identify changed fields
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    // Skip internal Strapi fields
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
      continue;
    }

    const beforeValue = before[key];
    const afterValue = after[key];

    // Check if value changed
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = {
        from: sanitizeValue(beforeValue),
        to: sanitizeValue(afterValue),
      };
      updatedFields.push(key);
    }
  }

  return {
    type: 'update',
    changes,
    updatedFields,
  };
}

/**
 * Build payload for delete action
 * Stores the complete data of the deleted record
 */
function buildDeletePayload(data: any): DeletePayload {
  return {
    type: 'delete',
    deletedData: sanitizeData(data),
  };
}

/**
 * Sanitize data before storing in audit log
 * Removes sensitive fields and handles circular references
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  try {
    // Create a deep copy to avoid modifying original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'resetPasswordToken', 'confirmationToken', 'token', 'secret'];
    
    function removeSensitiveFields(obj: any): any {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(removeSensitiveFields);
      }

      const cleaned: any = {};
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          cleaned[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          cleaned[key] = removeSensitiveFields(obj[key]);
        } else {
          cleaned[key] = obj[key];
        }
      }
      return cleaned;
    }

    return removeSensitiveFields(sanitized);
  } catch (error) {
    // If sanitization fails, return a safe fallback
    return { error: 'Failed to sanitize data' };
  }
}

/**
 * Sanitize a single value
 */
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object') {
    return sanitizeData(value);
  }

  return value;
}

/**
 * Extract metadata from request context
 * Captures IP address, user agent, and request ID
 */
export function extractMetadata(context: any): AuditMetadata {
  const metadata: AuditMetadata = {};

  try {
    // Extract IP address
    if (context.request?.ip) {
      metadata.ip = context.request.ip;
    } else if (context.request?.headers?.['x-forwarded-for']) {
      // Handle proxied requests
      const forwardedFor = context.request.headers['x-forwarded-for'];
      metadata.ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim();
    } else if (context.request?.socket?.remoteAddress) {
      metadata.ip = context.request.socket.remoteAddress;
    }

    // Extract user agent
    if (context.request?.headers?.['user-agent']) {
      metadata.userAgent = context.request.headers['user-agent'];
    }

    // Extract request ID if available
    if (context.request?.headers?.['x-request-id']) {
      metadata.requestId = context.request.headers['x-request-id'];
    } else if (context.requestId) {
      metadata.requestId = context.requestId;
    }
  } catch (error) {
    // If metadata extraction fails, log but continue
    // Metadata is nice-to-have, not critical
  }

  return metadata;
}