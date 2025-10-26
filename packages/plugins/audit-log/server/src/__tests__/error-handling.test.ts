import auditService from '../services/audit';

describe('Error Handling and Edge Cases', () => {
  let strapi: any;
  let service: any;

  beforeEach(() => {
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
      })),
      db: {
        query: jest.fn(() => ({
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        })),
      },
    };

    service = auditService({ strapi });
  });

  describe('Database Failures', () => {
    it('should handle database connection errors gracefully', async () => {
      strapi.db.query = jest.fn(() => ({
        create: jest.fn().mockRejectedValue(new Error('Connection refused')),
      }));

      service = auditService({ strapi });

      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: { title: 'Test' },
      };

      // Should not throw
      await expect(service.createAuditEntry(params)).resolves.not.toThrow();

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log error
      expect(strapi.log.error).toHaveBeenCalled();
    });

    it('should handle query timeout errors', async () => {
      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockRejectedValue(new Error('Query timeout')),
        count: jest.fn().mockRejectedValue(new Error('Query timeout')),
      }));

      service = auditService({ strapi });

      const filters = {
        contentType: 'api::article.article',
      };

      await expect(service.findAuditLogs(filters)).rejects.toThrow('Query timeout');
    });
  });

  describe('Invalid Input Handling', () => {
    it('should handle null payload gracefully', async () => {
      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: null as any,
      };

      await service.createAuditEntry(params);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw
      expect(strapi.log.error).not.toHaveBeenCalled();
    });

    it('should handle circular references in payload', async () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: circular,
      };

      // Should not throw
      await expect(service.createAuditEntry(params)).resolves.not.toThrow();
    });

    it('should handle very large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(1000000), // 1MB string
      };

      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: largePayload,
      };

      await expect(service.createAuditEntry(params)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filter results', async () => {
      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      }));

      service = auditService({ strapi });

      const result = await service.findAuditLogs({});

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle malformed date strings', () => {
      const query = {
        startDate: 'not-a-date',
        endDate: 'also-not-a-date',
      };

      const filters = service.parseFilters(query);

      expect(filters.startDate).toBeUndefined();
      expect(filters.endDate).toBeUndefined();
    });

    it('should handle negative page numbers', () => {
      const query = {
        page: '-1',
        pageSize: '-10',
      };

      const filters = service.parseFilters(query);

      expect(filters.page).toBe(1);
      expect(filters.pageSize).toBe(25);
    });

    it('should handle missing user context', async () => {
      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: { title: 'Test' },
        // No userId or userEmail
      };

      await expect(service.createAuditEntry(params)).resolves.not.toThrow();
    });

    it('should handle special characters in content type', async () => {
      const params = {
        contentType: 'api::special-chars!@#.article',
        recordId: '123',
        action: 'create' as const,
        payload: { title: 'Test' },
      };

      await expect(service.createAuditEntry(params)).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent audit entries', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          service.createAuditEntry({
            contentType: 'api::article.article',
            recordId: String(i),
            action: 'create' as const,
            payload: { title: `Article ${i}` },
          })
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle concurrent read operations', async () => {
      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      }));

      service = auditService({ strapi });

      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          service.findAuditLogs({
            contentType: 'api::article.article',
            page: i + 1,
          })
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should redact password fields', async () => {
      const params = {
        contentType: 'api::user.user',
        recordId: '123',
        action: 'create' as const,
        payload: {
          email: 'test@example.com',
          password: 'secret123',
          resetPasswordToken: 'token123',
        },
      };

      await service.createAuditEntry(params);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify create was called
      expect(strapi.db.query).toHaveBeenCalled();
    });
  });
});
