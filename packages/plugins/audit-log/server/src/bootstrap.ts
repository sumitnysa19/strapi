import type { Core } from '@strapi/types';
import { loadConfig, getConfigSummary } from './config/loader';

/**
 * Plugin bootstrap function
 * Called after all plugins are loaded and registered
 * 
 * This phase is responsible for:
 * - Creating database indexes for performance
 * - Registering permissions with Strapi's permission system
 * - Initializing lifecycle hooks for automatic audit capture
 * - Validating the plugin is ready to operate
 */
export default async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('Bootstrapping audit-log plugin');
  
  try {
    // Load and validate configuration
    const config = loadConfig(strapi);
    
    // Log configuration status
    strapi.log.info('Audit-log configuration loaded:', getConfigSummary(config));
    
    if (!config.enabled) {
      strapi.log.warn('Audit logging is disabled in configuration');
      strapi.log.info('Audit-log plugin bootstrap completed (disabled)');
      return;
    }
    
    strapi.log.info('Audit logging is enabled');
    
    // Create database indexes for optimal query performance
    await createDatabaseIndexes(strapi);
    
    // Register permissions with Strapi's permission system
    const permissionService = strapi.plugin('audit-log').service('permission');
    await permissionService.registerPermissions();
    
    // Initialize lifecycle hooks for audit logging
    await initializeLifecycleHooks(strapi);
    
    // Log bootstrap completion
    strapi.log.info('Audit-log plugin bootstrap completed successfully');
  } catch (error) {
    strapi.log.error('Failed to bootstrap audit-log plugin:', error);
    throw error;
  }
};

/**
 * Create database indexes for the audit_logs table
 * These indexes optimize query performance for common filtering operations
 */
async function createDatabaseIndexes(strapi: Core.Strapi) {
  try {
    const tableName = 'audit_logs';
    const db = strapi.db.connection;

    // Check if table exists
    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      strapi.log.warn(`Table ${tableName} does not exist yet. Indexes will be created on first migration.`);
      return;
    }

    strapi.log.info('Creating database indexes for audit_logs table');

    // Index on contentType for filtering by content type
    const contentTypeIndexName = 'audit_logs_content_type_idx';
    const hasContentTypeIndex = await db.schema.hasColumn(tableName, 'content_type');
    if (hasContentTypeIndex) {
      await db.schema.raw(`
        CREATE INDEX IF NOT EXISTS ${contentTypeIndexName} 
        ON ${tableName} (content_type)
      `).catch((err: Error) => {
        // Index might already exist, log but don't fail
        strapi.log.debug(`Index ${contentTypeIndexName} creation skipped:`, err.message);
      });
    }

    // Composite index on (contentType, timestamp) for efficient filtering and sorting
    const compositeIndexName = 'audit_logs_content_type_timestamp_idx';
    await db.schema.raw(`
      CREATE INDEX IF NOT EXISTS ${compositeIndexName} 
      ON ${tableName} (content_type, timestamp DESC)
    `).catch((err: Error) => {
      strapi.log.debug(`Index ${compositeIndexName} creation skipped:`, err.message);
    });

    // Index on userId for filtering by user
    const userIdIndexName = 'audit_logs_user_id_idx';
    const hasUserIdColumn = await db.schema.hasColumn(tableName, 'user_id');
    if (hasUserIdColumn) {
      await db.schema.raw(`
        CREATE INDEX IF NOT EXISTS ${userIdIndexName} 
        ON ${tableName} (user_id)
      `).catch((err: Error) => {
        strapi.log.debug(`Index ${userIdIndexName} creation skipped:`, err.message);
      });
    }

    // Index on action for filtering by action type
    const actionIndexName = 'audit_logs_action_idx';
    const hasActionColumn = await db.schema.hasColumn(tableName, 'action');
    if (hasActionColumn) {
      await db.schema.raw(`
        CREATE INDEX IF NOT EXISTS ${actionIndexName} 
        ON ${tableName} (action)
      `).catch((err: Error) => {
        strapi.log.debug(`Index ${actionIndexName} creation skipped:`, err.message);
      });
    }

    // Index on timestamp for date range queries and sorting
    const timestampIndexName = 'audit_logs_timestamp_idx';
    const hasTimestampColumn = await db.schema.hasColumn(tableName, 'timestamp');
    if (hasTimestampColumn) {
      await db.schema.raw(`
        CREATE INDEX IF NOT EXISTS ${timestampIndexName} 
        ON ${tableName} (timestamp DESC)
      `).catch((err: Error) => {
        strapi.log.debug(`Index ${timestampIndexName} creation skipped:`, err.message);
      });
    }

    // Composite index on (userId, timestamp) for user-specific queries
    const userTimestampIndexName = 'audit_logs_user_id_timestamp_idx';
    if (hasUserIdColumn && hasTimestampColumn) {
      await db.schema.raw(`
        CREATE INDEX IF NOT EXISTS ${userTimestampIndexName} 
        ON ${tableName} (user_id, timestamp DESC)
      `).catch((err: Error) => {
        strapi.log.debug(`Index ${userTimestampIndexName} creation skipped:`, err.message);
      });
    }

    strapi.log.info('Database indexes created successfully for audit_logs table');
  } catch (error) {
    // Log error but don't fail bootstrap - indexes are an optimization
    strapi.log.error('Failed to create database indexes:', error);
    strapi.log.warn('Audit logging will continue without optimized indexes');
  }
}

/**
 * Initialize lifecycle hooks for automatic audit capture
 * Integrates with Strapi's document service middleware
 */
async function initializeLifecycleHooks(strapi: Core.Strapi) {
  strapi.log.info('Initializing audit log lifecycle hooks');

  try {
    // Register document service middleware for capturing content operations
    strapi.documents.use(async (context: any, next: any) => {
      const auditService = strapi.plugin('audit-log').service('audit');

      // Check if auditing is enabled globally
      if (!auditService.isAuditingEnabled()) {
        return next();
      }

      // Check if this content type is excluded from auditing
      if (auditService.isContentTypeExcluded(context.contentType.uid)) {
        return next();
      }

      // Capture before-state for update and delete operations
      let beforeData = null;
      if (shouldCaptureBeforeState(context.action)) {
        beforeData = await captureBeforeState(strapi, context);
      }

      // Execute the actual operation
      const result = await next();

      // Create audit entry asynchronously (non-blocking)
      // Using process.nextTick to ensure content operation completes first
      process.nextTick(() => {
        createAuditEntryFromContext(strapi, context, result, beforeData)
          .catch((error) => {
            strapi.log.error('Failed to create audit entry:', error);
          });
      });

      return result;
    });

    strapi.log.info('Audit log lifecycle hooks initialized successfully');
  } catch (error) {
    strapi.log.error('Failed to initialize lifecycle hooks:', error);
    throw error;
  }
}

/**
 * Determine if we should capture before-state for this action
 * Update and delete operations need before-state to show what changed
 */
function shouldCaptureBeforeState(action: string): boolean {
  return action === 'update' || action === 'delete';
}

/**
 * Capture the current state of a record before it's modified or deleted
 * This allows us to show what changed in update operations
 */
async function captureBeforeState(strapi: Core.Strapi, context: any): Promise<any> {
  try {
    const recordId = extractRecordId(context);
    if (!recordId) {
      return null;
    }

    // Fetch the current state of the record
    const beforeState = await strapi.documents(context.contentType.uid).findOne({
      documentId: recordId,
    });

    return beforeState;
  } catch (error) {
    strapi.log.debug('Failed to capture before-state:', error);
    return null;
  }
}

/**
 * Create an audit entry from the lifecycle hook context
 * Extracts all necessary information and calls the audit service
 */
async function createAuditEntryFromContext(
  strapi: Core.Strapi,
  context: any,
  result: any,
  beforeData: any
): Promise<void> {
  try {
    const auditService = strapi.plugin('audit-log').service('audit');

    // Map Strapi action to audit action type
    const auditAction = mapActionType(context.action);
    if (!auditAction) {
      // Unknown action type, skip auditing
      return;
    }

    // Extract record ID from context or result
    const recordId = extractRecordId(context, result);
    if (!recordId) {
      strapi.log.debug('Could not extract record ID for audit entry');
      return;
    }

    // Extract user context from request state
    const userContext = extractUserContext(context);

    // Build payload based on action type
    const payload = buildPayloadFromContext(auditAction, context, result, beforeData);

    // Extract metadata from request
    const metadata = extractMetadataFromContext(context);

    // Create the audit entry
    await auditService.createAuditEntry({
      contentType: context.contentType.uid,
      recordId: String(recordId),
      action: auditAction,
      userId: userContext.userId,
      userEmail: userContext.userEmail,
      payload,
      metadata,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never block operations
    strapi.log.error('Error creating audit entry from context:', error);
  }
}

/**
 * Map Strapi document service action to audit action type
 * Strapi uses different action names than our audit system
 */
function mapActionType(strapiAction: string): 'create' | 'update' | 'delete' | null {
  const actionMap: Record<string, 'create' | 'update' | 'delete'> = {
    'create': 'create',
    'update': 'update',
    'delete': 'delete',
    'publish': 'update',    // Publishing is treated as an update
    'unpublish': 'update',  // Unpublishing is treated as an update
  };

  return actionMap[strapiAction] || null;
}

/**
 * Extract record ID from context or result
 * Different operations provide the ID in different places
 */
function extractRecordId(context: any, result?: any): string | null {
  // Try to get ID from result first (for create operations)
  if (result?.documentId) {
    return result.documentId;
  }
  if (result?.id) {
    return String(result.id);
  }

  // Try to get ID from context params (for update/delete operations)
  if (context.params?.documentId) {
    return context.params.documentId;
  }
  if (context.params?.id) {
    return String(context.params.id);
  }

  // Try to get ID from context data
  if (context.params?.data?.documentId) {
    return context.params.data.documentId;
  }
  if (context.params?.data?.id) {
    return String(context.params.data.id);
  }

  return null;
}

/**
 * Extract user context from request state
 * Returns user ID and email if available
 */
function extractUserContext(context: any): { userId?: number; userEmail?: string } {
  const userContext: { userId?: number; userEmail?: string } = {};

  try {
    // Check for authenticated user in state
    if (context.state?.user) {
      const user = context.state.user;
      
      if (user.id) {
        userContext.userId = Number(user.id);
      }
      
      if (user.email) {
        userContext.userEmail = user.email;
      }
    }

    // Also check for user in request context (alternative location)
    if (!userContext.userId && context.request?.state?.user) {
      const user = context.request.state.user;
      
      if (user.id) {
        userContext.userId = Number(user.id);
      }
      
      if (user.email) {
        userContext.userEmail = user.email;
      }
    }
  } catch (error) {
    // If user extraction fails, continue without user context
    // This might happen for system operations or unauthenticated requests
  }

  return userContext;
}

/**
 * Build payload based on action type and available data
 * Different actions require different payload structures
 */
function buildPayloadFromContext(
  action: 'create' | 'update' | 'delete',
  context: any,
  result: any,
  beforeData: any
): object {
  switch (action) {
    case 'create':
      // For create, store the complete created data
      return {
        data: result || context.params?.data || {},
      };

    case 'update':
      // For update, store before/after comparison
      return {
        before: beforeData || {},
        after: result || context.params?.data || {},
      };

    case 'delete':
      // For delete, store the data that was deleted
      return {
        data: beforeData || result || {},
      };

    default:
      return {};
  }
}

/**
 * Extract metadata from request context
 * Captures IP address, user agent, and request ID
 */
function extractMetadataFromContext(context: any): object {
  const metadata: any = {};

  try {
    // Extract IP address
    if (context.request?.ip) {
      metadata.ip = context.request.ip;
    } else if (context.request?.headers?.['x-forwarded-for']) {
      const forwardedFor = context.request.headers['x-forwarded-for'];
      metadata.ip = Array.isArray(forwardedFor) 
        ? forwardedFor[0] 
        : forwardedFor.split(',')[0].trim();
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
    // If metadata extraction fails, continue with empty metadata
    // Metadata is nice-to-have, not critical
  }

  return metadata;
}