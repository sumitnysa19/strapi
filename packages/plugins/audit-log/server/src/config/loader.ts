import type { Core } from '@strapi/types';
import type { AuditLogConfig } from '../types';

/**
 * Default configuration values
 * These are used when no custom configuration is provided
 */
export const DEFAULT_CONFIG: AuditLogConfig = {
  enabled: true,
  excludeContentTypes: [],
  retentionDays: 365,
  batchSize: 100,
  asyncProcessing: true,
};

/**
 * Load and validate plugin configuration
 * 
 * Configuration can be provided in config/plugins.js:
 * 
 * module.exports = {
 *   'audit-log': {
 *     enabled: true,
 *     config: {
 *       enabled: true,
 *       excludeContentTypes: ['admin::user'],
 *       retentionDays: 365,
 *       batchSize: 100,
 *       asyncProcessing: true,
 *     }
 *   }
 * };
 * 
 * @param strapi - Strapi instance
 * @returns Validated configuration object
 */
export function loadConfig(strapi: Core.Strapi): AuditLogConfig {
  try {
    // Load configuration from Strapi config
    const userConfig = strapi.config.get('plugin.audit-log', {});
    
    // Merge with defaults
    const config: AuditLogConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };
    
    // Validate configuration
    validateConfig(config);
    
    return config;
  } catch (error) {
    strapi.log.error('Failed to load audit-log configuration:', error);
    strapi.log.warn('Using default configuration');
    return DEFAULT_CONFIG;
  }
}

/**
 * Validate configuration structure and values
 * Throws an error if configuration is invalid
 * 
 * @param config - Configuration to validate
 */
export function validateConfig(config: AuditLogConfig): void {
  // Validate enabled flag
  if (typeof config.enabled !== 'boolean') {
    throw new Error('audit-log.enabled must be a boolean');
  }
  
  // Validate excludeContentTypes
  if (!Array.isArray(config.excludeContentTypes)) {
    throw new Error('audit-log.excludeContentTypes must be an array');
  }
  
  // Validate each content type in the exclusion list
  for (const contentType of config.excludeContentTypes) {
    if (typeof contentType !== 'string' || contentType.trim() === '') {
      throw new Error('audit-log.excludeContentTypes must contain non-empty strings');
    }
  }
  
  // Validate retentionDays
  if (config.retentionDays !== undefined) {
    if (typeof config.retentionDays !== 'number' || config.retentionDays <= 0) {
      throw new Error('audit-log.retentionDays must be a positive number');
    }
  }
  
  // Validate batchSize
  if (config.batchSize !== undefined) {
    if (typeof config.batchSize !== 'number' || config.batchSize <= 0) {
      throw new Error('audit-log.batchSize must be a positive number');
    }
    
    if (config.batchSize > 1000) {
      throw new Error('audit-log.batchSize must not exceed 1000');
    }
  }
  
  // Validate asyncProcessing
  if (config.asyncProcessing !== undefined) {
    if (typeof config.asyncProcessing !== 'boolean') {
      throw new Error('audit-log.asyncProcessing must be a boolean');
    }
  }
}

/**
 * Get a human-readable summary of the configuration
 * Useful for logging and debugging
 * 
 * @param config - Configuration to summarize
 * @returns Configuration summary object
 */
export function getConfigSummary(config: AuditLogConfig): object {
  return {
    enabled: config.enabled,
    excludedContentTypes: config.excludeContentTypes.length,
    retentionDays: config.retentionDays,
    batchSize: config.batchSize,
    asyncProcessing: config.asyncProcessing,
  };
}

/**
 * Check if a specific content type is excluded from auditing
 * 
 * @param config - Plugin configuration
 * @param contentType - Content type UID to check
 * @returns True if the content type should be excluded
 */
export function isContentTypeExcluded(config: AuditLogConfig, contentType: string): boolean {
  if (!config.enabled) {
    return true; // If auditing is disabled, all content types are excluded
  }
  
  return config.excludeContentTypes.includes(contentType);
}

/**
 * Check if auditing is enabled globally
 * 
 * @param config - Plugin configuration
 * @returns True if auditing is enabled
 */
export function isAuditingEnabled(config: AuditLogConfig): boolean {
  return config.enabled === true;
}
