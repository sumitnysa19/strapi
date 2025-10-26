import auditService from '../services/audit';

describe('Performance Tests', () => {
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
          batchSize: 100,
        },
      })),
      db: {
        query: jest.fn(() => ({
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        })),
      },
    };

    service = auditService({ strapi });
  });

  describe('High Volume Audit Entry Creation', () => {
    it('should handle 100 audit entries within reasonable time', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          service.createAuditEntry({
            contentType: 'api::article.article',
            recordId: String(i),
            action: 'create' as const,
            payload: { title: `Article ${i}` },
          })
        );
      }

      await Promise.all(promises);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000);

    it('should not block content operations', async () => {
      const contentOperation = jest.fn().mockResolvedValue({ id: 1 });

      const startTime = Date.now();

      // Simulate content operation with audit logging
      const result = await contentOperation();

      // Create audit entry asynchronously
      service.createAuditEntry({
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: result,
      });

      const contentDuration = Date.now() - startTime;

      // Content operation should complete quickly (< 100ms)
      expect(contentDuration).toBeLessThan(100);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('Query Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        contentType: 'api::article.article',
        recordId: String(i),
        action: 'create',
        timestamp: new Date(),
      }));

      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue(largeDataset.slice(0, 100)),
        count: jest.fn().mockResolvedValue(1000),
      }));

      service = auditService({ strapi });

      const startTime = Date.now();

      const result = await service.findAuditLogs({
        page: 1,
        pageSize: 100,
      });

      const duration = Date.now() - startTime;

      expect(result.data.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex filter combinations efficiently', async () => {
      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      }));

      service = auditService({ strapi });

      const startTime = Date.now();

      await service.findAuditLogs({
        contentType: 'api::article.article',
        userId: 1,
        action: 'update',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        page: 1,
        pageSize: 50,
        sort: 'desc',
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory Usage', () => {
    it('should handle large payloads without memory issues', async () => {
      const largePayload = {
        content: 'x'.repeat(100000), // 100KB string
        metadata: Array.from({ length: 1000 }, (_, i) => ({
          key: `field_${i}`,
          value: `value_${i}`,
        })),
      };

      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          service.createAuditEntry({
            contentType: 'api::article.article',
            recordId: String(i),
            action: 'create' as const,
            payload: largePayload,
          })
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Circuit Breaker Performance', () => {
    it('should fail fast when circuit is open', async () => {
      // Simulate database failures to open circuit
      strapi.db.query = jest.fn(() => ({
        create: jest.fn().mockRejectedValue(new Error('DB error')),
      }));

      service = auditService({ strapi });

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        await service.createAuditEntry({
          contentType: 'api::article.article',
          recordId: String(i),
          action: 'create' as const,
          payload: {},
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Now measure performance with open circuit
      const startTime = Date.now();

      await service.createAuditEntry({
        contentType: 'api::article.article',
        recordId: '999',
        action: 'create' as const,
        payload: {},
      });

      const duration = Date.now() - startTime;

      // Should fail fast (< 50ms) instead of retrying
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process queue efficiently', async () => {
      const queue = service.getQueueStats();

      // Enqueue multiple items
      for (let i = 0; i < 50; i++) {
        await service.createAuditEntry({
          contentType: 'api::article.article',
          recordId: String(i),
          action: 'create' as const,
          payload: { title: `Article ${i}` },
        });
      }

      const startTime = Date.now();

      await service.flushQueue();

      const duration = Date.now() - startTime;

      // Batch processing should be efficient
      expect(duration).toBeLessThan(2000);
    });
  });
});
