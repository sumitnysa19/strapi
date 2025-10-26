/**
 * Audit log plugin routes
 * 
 * All routes require authentication and proper permissions
 */
export default [
  {
    method: 'GET',
    path: '/audit-logs',
    handler: 'audit-log.find',
    config: {
      // Apply permission validation policy
      policies: ['plugin::audit-log.has-permission'],
      // Require authentication
      auth: {
        scope: ['plugin::audit-log.read'],
      },
    },
  },
];