import type { Core } from '@strapi/strapi';

/**
 * Audit log controller
 * Handles HTTP requests for audit log operations
 */
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Find audit logs with filtering and pagination
   * GET /audit-logs
   * 
   * Requires authentication and 'plugin::audit-log.read' permission
   * 
   * Query parameters:
   * - contentType: Filter by content type (e.g., 'api::article.article')
   * - userId: Filter by user ID
   * - action: Filter by action type ('create', 'update', 'delete')
   * - startDate: Filter by start date (ISO 8601 format)
   * - endDate: Filter by end date (ISO 8601 format)
   * - page: Page number for pagination (default: 1)
   * - pageSize: Number of items per page (default: 25, max: 100)
   * - sort: Sort order ('asc' or 'desc', default: 'desc')
   * 
   * @param ctx - Koa context
   */
  async find(ctx: any) {
    strapi.log.debug('Audit log find endpoint called', {
      query: ctx.request.query,
      userId: ctx.state.user?.id,
    });
    
    try {
      // Validate permissions - this will throw if user doesn't have access
      const permissionService = strapi.plugin('audit-log').service('permission');
      await permissionService.validateReadAccess(ctx.state.user);
      
      // Parse and validate query filters
      const auditService = strapi.plugin('audit-log').service('audit');
      const filters = auditService.parseFilters(ctx.request.query);
      
      // Fetch audit logs with filters
      const result = await auditService.findAuditLogs(filters);
      
      // Return formatted response
      ctx.body = {
        data: result.data,
        meta: {
          pagination: result.pagination,
        },
      };
      
      strapi.log.debug('Audit logs retrieved successfully', {
        count: result.data.length,
        total: result.pagination.total,
        page: result.pagination.page,
      });
    } catch (error: any) {
      // Log the error with context
      strapi.log.error('Error in audit log find endpoint:', {
        error: error.message,
        status: error.status,
        userId: ctx.state.user?.id,
        query: ctx.request.query,
      });
      
      // Throw with appropriate status code
      // Permission errors will have status 401 or 403
      // Other errors default to 500
      const status = error.status || 500;
      const message = error.message || 'Internal server error';
      
      ctx.throw(status, message);
    }
  },
});