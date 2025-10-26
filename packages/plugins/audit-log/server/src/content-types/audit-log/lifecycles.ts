import type { Core } from '@strapi/strapi';

/**
 * Lifecycle hooks for the audit-log content type
 * These hooks enforce validation rules and ensure data integrity
 */
export default {
  /**
   * Validate audit entry before creation
   * Ensures all required fields are present and valid
   */
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Validate required fields
    if (!data.contentType || typeof data.contentType !== 'string') {
      throw new Error('contentType is required and must be a string');
    }

    if (!data.recordId || typeof data.recordId !== 'string') {
      throw new Error('recordId is required and must be a string');
    }

    if (!data.action || !['create', 'update', 'delete'].includes(data.action)) {
      throw new Error('action is required and must be one of: create, update, delete');
    }

    if (!data.timestamp) {
      throw new Error('timestamp is required');
    }

    if (!data.payload || typeof data.payload !== 'object') {
      throw new Error('payload is required and must be an object');
    }

    // Validate userId if provided
    if (data.userId !== undefined && data.userId !== null) {
      if (typeof data.userId !== 'number' || data.userId < 1) {
        throw new Error('userId must be a positive integer');
      }
    }

    // Validate userEmail format if provided
    if (data.userEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.userEmail)) {
        throw new Error('userEmail must be a valid email address');
      }
    }

    // Validate metadata structure if provided
    if (data.metadata !== undefined && data.metadata !== null) {
      if (typeof data.metadata !== 'object') {
        throw new Error('metadata must be an object');
      }
    }

    // Validate contentType format (should be like 'api::article.article' or 'plugin::users-permissions.user')
    const contentTypeRegex = /^(api|plugin)::[a-z0-9-]+\.[a-z0-9-]+$/i;
    if (!contentTypeRegex.test(data.contentType)) {
      throw new Error('contentType must follow the format: api::name.name or plugin::name.name');
    }
  },

  /**
   * Prevent updates to audit log entries
   * Audit logs are immutable once created
   */
  async beforeUpdate(event: any) {
    throw new Error('Audit log entries are immutable and cannot be updated');
  },

  /**
   * Prevent deletion of audit log entries through the API
   * Audit logs should only be deleted through retention policies
   */
  async beforeDelete(event: any) {
    throw new Error('Audit log entries cannot be deleted through the API');
  },

  /**
   * Prevent bulk deletion of audit log entries
   */
  async beforeDeleteMany(event: any) {
    throw new Error('Audit log entries cannot be deleted through the API');
  },
};
