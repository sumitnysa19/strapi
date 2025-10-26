describe('Lifecycle Hook Integration', () => {
  let strapi: any;
  let auditService: any;
  let lifecycleMiddleware: any;

  beforeEach(() => {
    auditService = {
      isAuditingEnabled: jest.fn().mockReturnValue(true),
      isContentTypeExcluded: jest.fn().mockReturnValue(false),
      createAuditEntry: jest.fn().mockResolvedValue(undefined),
    };

    const permissionService = {
      registerPermissions: jest.fn().mockResolvedValue(undefined),
    };

    strapi = {
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      plugin: jest.fn(() => ({
        config: {
          enabled: true,
          excludeContentTypes: [],
        },
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return permissionService;
          }
          return auditService;
        }),
      })),
      documents: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Old Title',
        }),
      })),
      db: {
        connection: {
          schema: {
            hasTable: jest.fn().mockResolvedValue(true),
            hasColumn: jest.fn().mockResolvedValue(true),
            raw: jest.fn().mockResolvedValue(undefined),
          },
        },
      },
    };

    // Capture the middleware function
    lifecycleMiddleware = null;
    strapi.documents.use = jest.fn((middleware) => {
      lifecycleMiddleware = middleware;
    });
  });

  describe('Create Operation', () => {
    it('should create audit entry for create action', async () => {
      const context = {
        contentType: { uid: 'api::article.article' },
        action: 'create',
        params: {
          data: { title: 'New Article' },
        },
        state: {
          user: { id: 1, email: 'test@example.com' },
        },
        request: {
          ip: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
        },
      };

      const result = { documentId: '123', title: 'New Article' };
      const next = jest.fn().mockResolvedValue(result);

      // Initialize lifecycle hooks
      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      // Execute middleware
      await lifecycleMiddleware(context, next);

      // Wait for async audit entry creation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(next).toHaveBeenCalled();
      expect(auditService.createAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'api::article.article',
          recordId: '123',
          action: 'create',
          userId: 1,
          userEmail: 'test@example.com',
        })
      );
    });
  });

  describe('Update Operation', () => {
    it('should create audit entry for update action with before/after data', async () => {
      const context = {
        contentType: { uid: 'api::article.article' },
        action: 'update',
        params: {
          documentId: '123',
          data: { title: 'Updated Title' },
        },
        state: {
          user: { id: 1, email: 'test@example.com' },
        },
      };

      const result = { documentId: '123', title: 'Updated Title' };
      const next = jest.fn().mockResolvedValue(result);

      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      await lifecycleMiddleware(context, next);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(next).toHaveBeenCalled();
      expect(strapi.documents).toHaveBeenCalledWith('api::article.article');
    });
  });

  describe('Delete Operation', () => {
    it('should create audit entry for delete action', async () => {
      const context = {
        contentType: { uid: 'api::article.article' },
        action: 'delete',
        params: {
          documentId: '123',
        },
        state: {
          user: { id: 1, email: 'test@example.com' },
        },
      };

      const result = { documentId: '123' };
      const next = jest.fn().mockResolvedValue(result);

      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      await lifecycleMiddleware(context, next);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Configuration Filtering', () => {
    it('should skip audit when auditing is disabled', async () => {
      auditService.isAuditingEnabled = jest.fn().mockReturnValue(false);

      const context = {
        contentType: { uid: 'api::article.article' },
        action: 'create',
        params: { data: {} },
      };

      const next = jest.fn().mockResolvedValue({});

      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      await lifecycleMiddleware(context, next);

      expect(next).toHaveBeenCalled();
      expect(auditService.createAuditEntry).not.toHaveBeenCalled();
    });

    it('should skip audit for excluded content types', async () => {
      auditService.isContentTypeExcluded = jest.fn().mockReturnValue(true);

      const context = {
        contentType: { uid: 'api::excluded.excluded' },
        action: 'create',
        params: { data: {} },
      };

      const next = jest.fn().mockResolvedValue({});

      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      await lifecycleMiddleware(context, next);

      expect(next).toHaveBeenCalled();
      expect(auditService.createAuditEntry).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should not block operation when audit entry creation fails', async () => {
      auditService.createAuditEntry = jest.fn().mockRejectedValue(new Error('Audit failed'));

      const context = {
        contentType: { uid: 'api::article.article' },
        action: 'create',
        params: { data: {} },
        state: { user: { id: 1 } },
      };

      const result = { documentId: '123' };
      const next = jest.fn().mockResolvedValue(result);

      const bootstrap = require('../bootstrap').default;
      await bootstrap({ strapi });

      const actualResult = await lifecycleMiddleware(context, next);

      expect(actualResult).toEqual(result);
      expect(next).toHaveBeenCalled();
    });
  });
});
