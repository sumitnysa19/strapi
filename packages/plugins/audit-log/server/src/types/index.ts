/**
 * Core TypeScript interfaces for the audit logging system
 */

/**
 * Audit log entry structure as stored in the database
 */
export interface AuditLogEntry {
  id: number;
  contentType: string;        // e.g., 'api::article.article'
  recordId: string;           // ID of the affected record
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  userId?: number;            // Authenticated user ID
  userEmail?: string;         // User email for reference
  payload: object;            // Full payload for create/delete, diff for update
  metadata: AuditMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata captured with each audit entry
 */
export interface AuditMetadata {
  ip?: string;              // Request IP address
  userAgent?: string;       // User agent string
  requestId?: string;       // Request correlation ID
}

/**
 * Parameters for creating a new audit entry
 */
export interface CreateAuditEntryParams {
  contentType: string;
  recordId: string;
  action: 'create' | 'update' | 'delete';
  userId?: number;
  userEmail?: string;
  payload: object;
  metadata?: AuditMetadata;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  contentType?: string;
  userId?: number;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
  sort?: 'asc' | 'desc';
}

/**
 * Paginated audit log results
 */
export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}

/**
 * Plugin configuration interface
 */
export interface AuditLogConfig {
  enabled: boolean;
  excludeContentTypes: string[];
  retentionDays?: number;
  batchSize?: number;
  asyncProcessing?: boolean;
}

/**
 * Audit service interface
 */
export interface AuditService {
  createAuditEntry(params: CreateAuditEntryParams): Promise<void>;
  findAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs>;
  isAuditingEnabled(): boolean;
  isContentTypeExcluded(contentType: string): boolean;
  parseFilters(query: any): AuditLogFilters;
  getCircuitBreakerStatus(): { state: string; failureCount: number };
  getQueueStats(): { size: number; processed: number; failed: number; dropped: number };
  flushQueue(): Promise<void>;
  resetCircuitBreaker(): void;
}

/**
 * Permission service interface
 */
export interface PermissionService {
  validateReadAccess(user: any): Promise<void>;
  registerPermissions(): Promise<void>;
}

/**
 * Strapi context for lifecycle hooks
 */
export interface StrapiContext {
  contentType: {
    uid: string;
  };
  action: string;
  params: any;
  state?: {
    user?: {
      id: number;
      email?: string;
    };
  };
  request?: {
    ip?: string;
    headers?: {
      'user-agent'?: string;
    };
  };
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

/**
 * Payload structure for different action types
 */
export interface CreatePayload {
  type: 'create';
  data: object;
}

export interface UpdatePayload {
  type: 'update';
  changes: Record<string, {
    from: any;
    to: any;
  }>;
  updatedFields: string[];
}

export interface DeletePayload {
  type: 'delete';
  deletedData: object;
}

export type AuditPayload = CreatePayload | UpdatePayload | DeletePayload;