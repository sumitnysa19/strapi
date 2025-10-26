import type { Core } from '@strapi/types';

/**
 * Plugin registration function
 * Called when the plugin is loaded by Strapi
 * 
 * This phase happens before bootstrap and is used for:
 * - Validating plugin configuration
 * - Registering services, controllers, and routes
 * - Setting up any pre-bootstrap initialization
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('Registering audit-log plugin');
  
  try {
    // Validate plugin configuration
    const config = strapi.config.get('plugin.audit-log');
    
    if (config) {
      strapi.log.debug('Audit-log plugin configuration loaded:', {
        enabled: config.enabled,
        excludeContentTypes: config.excludeContentTypes?.length || 0,
        retentionDays: config.retentionDays,
        batchSize: config.batchSize,
        asyncProcessing: config.asyncProcessing,
      });
      
      // Validate configuration structure
      if (typeof config.enabled !== 'boolean') {
        strapi.log.warn('audit-log.enabled should be a boolean, defaulting to true');
      }
      
      if (config.excludeContentTypes && !Array.isArray(config.excludeContentTypes)) {
        strapi.log.warn('audit-log.excludeContentTypes should be an array, defaulting to empty array');
      }
    } else {
      strapi.log.info('No custom configuration found, using defaults');
    }
    
    // Log registration completion
    strapi.log.info('Audit-log plugin registered successfully');
  } catch (error) {
    strapi.log.error('Error during audit-log plugin registration:', error);
    throw error;
  }
};