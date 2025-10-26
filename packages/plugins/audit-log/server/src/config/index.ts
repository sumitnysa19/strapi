import type { AuditLogConfig } from '../types';
import { DEFAULT_CONFIG, validateConfig } from './loader';

/**
 * Plugin configuration export
 * 
 * This is used by Strapi to load and validate the plugin configuration.
 * The configuration can be customized in config/plugins.js
 */
export default {
  default: DEFAULT_CONFIG,
  validator: validateConfig,
};