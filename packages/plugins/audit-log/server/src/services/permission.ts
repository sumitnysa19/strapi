import type { Core } from '@strapi/strapi';
import type { PermissionService } from '../types';

/**
 * Permission action definitions for audit log plugin
 * These actions are registered with Strapi's permission system
 */
const AUDIT_LOG_ACTIONS = [
  {
    section: 'plugins',
    displayName: 'Read audit logs',
    uid: 'read',
    pluginName: 'audit-log',
    subCategory: 'general',
  },
];

/**
 * Permission service implementation
 * Handles access control for audit log functionality
 */
export default ({ strapi }: { strapi: Core.Strapi }): PermissionService => ({
  /**
   * Validate that a user has read access to audit logs
   * Throws an error if the user doesn't have the required permission
   * 
   * @param user - The authenticated user object
   * @throws {Error} If user is not authenticated
   * @throws {Error} If user doesn't have read permission
   */
  async validateReadAccess(user: any): Promise<void> {
    strapi.log.debug('Validating audit log read access for user:', user?.id);
    
    // Check if user is authenticated
    if (!user) {
      const error = new Error('Authentication required to access audit logs');
      (error as any).status = 401;
      (error as any).name = 'UnauthorizedError';
      throw error;
    }
    
    try {
      // Get the user's ability from the admin permission service
      const permissionService = strapi.service('admin::permission');
      const { engine } = permissionService;
      
      // Build ability for the user
      // For admin users, we need to get their role and permissions
      let userAbility;
      
      if (user.roles) {
        // Admin user - get permissions from roles
        const roleService = strapi.service('admin::role');
        const userRoles = await roleService.findMany({
          where: {
            id: { $in: user.roles.map((r: any) => r.id || r) },
          },
        });
        
        // Get all permissions for these roles
        const permissions: any[] = [];
        for (const role of userRoles) {
          if (role.permissions) {
            permissions.push(...role.permissions);
          }
        }
        
        // Build ability from permissions
        userAbility = await engine.generateUserAbility(permissions);
      } else {
        // For non-admin users, we might need different logic
        // For now, deny access
        const error = new Error('Insufficient permissions to access audit logs');
        (error as any).status = 403;
        (error as any).name = 'ForbiddenError';
        throw error;
      }
      
      // Check if user has permission to read audit logs
      const canRead = userAbility.can('plugin::audit-log.read', 'plugin::audit-log');
      
      if (!canRead) {
        strapi.log.warn('User does not have permission to read audit logs', {
          userId: user.id,
          userEmail: user.email,
        });
        
        const error = new Error('Insufficient permissions to access audit logs');
        (error as any).status = 403;
        (error as any).name = 'ForbiddenError';
        throw error;
      }
      
      strapi.log.debug('User has permission to read audit logs', {
        userId: user.id,
      });
    } catch (error) {
      // If error already has status, rethrow it
      if ((error as any).status) {
        throw error;
      }
      
      // Otherwise, log and throw a generic forbidden error
      strapi.log.error('Error validating audit log permissions:', error);
      const forbiddenError = new Error('Failed to validate permissions');
      (forbiddenError as any).status = 403;
      (forbiddenError as any).name = 'ForbiddenError';
      throw forbiddenError;
    }
  },

  /**
   * Register audit log permissions with Strapi's permission system
   * This is called during plugin bootstrap
   * 
   * Registers the following permissions:
   * - plugin::audit-log.read: Permission to read audit logs
   */
  async registerPermissions(): Promise<void> {
    strapi.log.info('Registering audit log permissions with Strapi permission system');
    
    try {
      // Get the admin permission service
      const permissionService = strapi.service('admin::permission');
      
      if (!permissionService || !permissionService.actionProvider) {
        strapi.log.warn('Admin permission service not available, skipping permission registration');
        return;
      }
      
      // Register all audit log actions
      await permissionService.actionProvider.registerMany(AUDIT_LOG_ACTIONS);
      
      strapi.log.info('Successfully registered audit log permissions', {
        actionsCount: AUDIT_LOG_ACTIONS.length,
        actions: AUDIT_LOG_ACTIONS.map(a => a.uid),
      });
    } catch (error) {
      strapi.log.error('Failed to register audit log permissions:', error);
      // Don't throw - permission registration failure shouldn't prevent plugin from loading
      // The plugin will still work, but permissions won't be available in the admin panel
    }
  },
});