import bootstrap from './bootstrap';
import register from './register';
import destroy from './destroy';
import services from './services';
import controllers from './controllers';
import routes from './routes';
import contentTypes from './content-types';
import policies from './policies';
import config from './config';

/**
 * Main plugin export
 * 
 * This function returns the plugin configuration object that Strapi uses
 * to initialize and manage the plugin lifecycle.
 * 
 * Lifecycle phases:
 * 1. register - Plugin registration and configuration validation
 * 2. bootstrap - Initialize services, hooks, and permissions
 * 3. destroy - Cleanup resources on shutdown
 */
export default () => ({
  register,
  bootstrap,
  destroy,
  config,
  services,
  controllers,
  routes,
  contentTypes,
  policies,
});