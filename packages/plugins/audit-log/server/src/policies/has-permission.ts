import type { Core } from '@strapi/strapi';

/**
 * Permission validation policy
 * Validates that the authenticated user has the required permission
 * 
 * This policy can be used in route configurations to enforce permission checks
 * before the controller handler is executed.
 * 
 * Usage in routes:
 * {
 *   method: 'GET',
 *   path: '/audit-logs',
 *   handler: 'audit-log.find',
 *   config: {
 *     policies: ['has-permission'],
 *   },
 * }
 */
export default (policyContext: any, config: any, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: any) => {
    strapi.log.debug('Executing has-permission policy', {
      userId: ctx.state.user?.id,
      path: ctx.request.path,
    });
    
    try {
      // Get the permission service
      const permissionService = strapi.plugin('audit-log').service('permission');
      
      // Validate that the user has read access
      await permissionService.validateReadAccess(ctx.state.user);
      
      // Permission check passed, continue to next middleware/handler
      return next();
    } catch (error: any) {
      // Log the permission denial
      strapi.log.warn('Permission denied in has-permission policy', {
        userId: ctx.state.user?.id,
        error: error.message,
        path: ctx.request.path,
      });
      
      // Throw the error to stop request processing
      // The error will be caught by Strapi's error handling middleware
      const status = error.status || 403;
      const message = error.message || 'Forbidden';
      
      ctx.throw(status, message);
    }
  };
};
