import auditLogController from '../audit-log';

describe('Audit Log Controller', () => {
  let strapi: any;
  let controller: any;

  beforeEach(() => {
    strapi = {
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      plugin: jest.fn(() => ({
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return {
              validateReadAccess: jest.fn().mockResolvedValue(undefined),
            };
          }
          if (serviceName === 'audit') {
            return {
              parseFilters: jest.fn().mockReturnValue({
                page: 1,
                pageSize: 25,
                sort: 'desc',
              }),
              findAuditLogs: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 1,
                    contentType: 'api::article.article',
                    recordId: '123',
                    action: 'create',
                    timestamp: new Date(),
                  },
                ],
                pagination: {
                  page: 1,
                  pageSize: 25,
                  pageCount: 1,
                  total: 1,
                },
              }),
            };
          }
          return {};
        }),
      })),
    };

    controller = auditLogController({ strapi });
  });

  describe('find', () => {
    it('should return audit logs for authorized user', async () => {
      const ctx: any = {
        request: {
          query: {
            contentType: 'api::article.article',
          },
        },
        state: {
          user: {
            id: 1,
            email: 'test@example.com',
          },
        },
        body: null,
      };

      await controller.find(ctx);

      expect(ctx.body).toHaveProperty('data');
      expect(ctx.body).toHaveProperty('meta');
      expect(ctx.body.data).toHaveLength(1);
      expect(ctx.body.meta.pagination.total).toBe(1);
    });

    it('should throw 401 for unauthenticated user', async () => {
      const permissionService = {
        validateReadAccess: jest.fn().mockRejectedValue(
          Object.assign(new Error('Authentication required'), { status: 401 })
        ),
      };

      strapi.plugin = jest.fn(() => ({
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return permissionService;
          }
          return {};
        }),
      }));

      controller = auditLogController({ strapi });

      const ctx: any = {
        request: { query: {} },
        state: {},
        throw: jest.fn((status, message) => {
          throw Object.assign(new Error(message), { status });
        }),
      };

      await expect(controller.find(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(401, expect.any(String));
    });

    it('should throw 403 for unauthorized user', async () => {
      const permissionService = {
        validateReadAccess: jest.fn().mockRejectedValue(
          Object.assign(new Error('Insufficient permissions'), { status: 403 })
        ),
      };

      strapi.plugin = jest.fn(() => ({
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return permissionService;
          }
          return {};
        }),
      }));

      controller = auditLogController({ strapi });

      const ctx: any = {
        request: { query: {} },
        state: {
          user: { id: 1 },
        },
        throw: jest.fn((status, message) => {
          throw Object.assign(new Error(message), { status });
        }),
      };

      await expect(controller.find(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(403, expect.any(String));
    });

    it('should handle service errors gracefully', async () => {
      const auditService = {
        parseFilters: jest.fn().mockReturnValue({}),
        findAuditLogs: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      strapi.plugin = jest.fn(() => ({
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return {
              validateReadAccess: jest.fn().mockResolvedValue(undefined),
            };
          }
          if (serviceName === 'audit') {
            return auditService;
          }
          return {};
        }),
      }));

      controller = auditLogController({ strapi });

      const ctx: any = {
        request: { query: {} },
        state: {
          user: { id: 1 },
        },
        throw: jest.fn((status, message) => {
          throw Object.assign(new Error(message), { status });
        }),
      };

      await expect(controller.find(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(500, expect.any(String));
    });
  });
});
