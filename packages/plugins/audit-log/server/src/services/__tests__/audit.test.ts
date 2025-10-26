import auditService from '../audit';
import type { Core } from '@strapi/types';

describe('Audit Service', () => {
  let strapi: any;
  let service: any;

  beforeEach(() => {
    // Mock Strapi instance
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
          excludeContentTypes: ['api::excluded.excluded'],
          retentionDays: 365,
          batchSize: 100,
          asyncProcessing: true,
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

  describe('createAuditEntry', () => {
    it('should create audit entry for create action', async () => {
      const params = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        userId: 1,
        userEmail: 'test@example.com',
        payload: { title: 'Test Article' },
        metadata: { ip: '127.0.0.1' },
      };

      await service.createAuditEntry(params);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(strapi.db.query).toHaveBeenCalledWith('plugin::audit-log.audit-log');
    });

    it('should handle missing required parameters gracefully', async () => {
      const params = {
        contentType: '',
        recordId: '',
        action: 'create' as const,
        payload: {},
      };

      // Should not throw even with invalid parameters
      await expect(service.createAuditEntry(params)).resolves.not.toThrow();

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('findAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const mockData = [
        {
          id: 1,
          contentType: 'api::article.article',
          recordId: '123',
          action: 'create',
          timestamp: new Date(),
        },
      ];

      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue(mockData),
        count: jest.fn().mockResolvedValue(1),
      }));

      const filters = {
        contentType: 'api::article.article',
        page: 1,
        pageSize: 25,
        sort: 'desc' as const,
      };

      const result = await service.findAuditLogs(filters);

      expect(result.data).toEqual(mockData);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      strapi.db.query = jest.fn(() => ({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(100),
      }));

      const filters = {
        page: 2,
        pageSize: 25,
      };

      const result = await service.findAuditLogs(filters);

      expect(result.pagination.pageCount).toBe(4);
      expect(result.pagination.total).toBe(100);
    });
  });

  describe('isAuditingEnabled', () => {
    it('should return true when auditing is enabled', () => {
      expect(service.isAuditingEnabled()).toBe(true);
    });

    it('should return false when auditing is disabled', () => {
      strapi.plugin = jest.fn(() => ({
        config: {
          enabled: false,
          excludeContentTypes: [],
        },
      }));

      service = auditService({ strapi });
      expect(service.isAuditingEnabled()).toBe(false);
    });
  });

  describe('isContentTypeExcluded', () => {
    it('should return true for excluded content types', () => {
      expect(service.isContentTypeExcluded('api::excluded.excluded')).toBe(true);
    });

    it('should return false for non-excluded content types', () => {
      expect(service.isContentTypeExcluded('api::article.article')).toBe(false);
    });
  });

  describe('parseFilters', () => {
    it('should parse valid query parameters', () => {
      const query = {
        contentType: 'api::article.article',
        userId: '1',
        action: 'create',
        page: '2',
        pageSize: '50',
        sort: 'asc',
      };

      const filters = service.parseFilters(query);

      expect(filters.contentType).toBe('api::article.article');
      expect(filters.userId).toBe(1);
      expect(filters.action).toBe('create');
      expect(filters.page).toBe(2);
      expect(filters.pageSize).toBe(50);
      expect(filters.sort).toBe('asc');
    });

    it('should handle invalid parameters gracefully', () => {
      const query = {
        userId: 'invalid',
        action: 'invalid-action',
        page: '-1',
        pageSize: '200',
      };

      const filters = service.parseFilters(query);

      expect(filters.userId).toBeUndefined();
      expect(filters.action).toBeUndefined();
      expect(filters.page).toBe(1);
      expect(filters.pageSize).toBe(100); // Max capped at 100
    });

    it('should parse date filters correctly', () => {
      const query = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      };

      const filters = service.parseFilters(query);

      expect(filters.startDate).toBeInstanceOf(Date);
      expect(filters.endDate).toBeInstanceOf(Date);
    });
  });
});
