import bootstrap from '../bootstrap';

describe('Bootstrap', () => {
  let strapi: any;

  beforeEach(() => {
    strapi = {
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      config: {
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'plugin.audit-log') {
            return {
              enabled: true,
              excludeContentTypes: [],
            };
          }
          return defaultValue;
        }),
      },
      plugin: jest.fn(() => ({
        config: {
          enabled: true,
          excludeContentTypes: [],
        },
        service: jest.fn((serviceName: string) => {
          if (serviceName === 'permission') {
            return {
              registerPermissions: jest.fn().mockResolvedValue(undefined),
            };
          }
          if (serviceName === 'audit') {
            return {
              isAuditingEnabled: jest.fn().mockReturnValue(true),
              isContentTypeExcluded: jest.fn().mockReturnValue(false),
              createAuditEntry: jest.fn().mockResolvedValue(undefined),
            };
          }
          return {};
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
      documents: {
        use: jest.fn(),
      },
    };
  });

  it('should bootstrap successfully when enabled', async () => {
    await bootstrap({ strapi });

    expect(strapi.log.info).toHaveBeenCalledWith('Bootstrapping audit-log plugin');
    expect(strapi.log.info).toHaveBeenCalledWith('Audit logging is enabled');
    expect(strapi.documents.use).toHaveBeenCalled();
  });

  it('should skip initialization when disabled', async () => {
    strapi.config = {
      get: jest.fn((key: string, defaultValue: any) => {
        if (key === 'plugin.audit-log') {
          return {
            enabled: false,
            excludeContentTypes: [],
          };
        }
        return defaultValue;
      }),
    };

    strapi.plugin = jest.fn(() => ({
      config: {
        enabled: false,
        excludeContentTypes: [],
      },
      service: jest.fn(() => ({
        registerPermissions: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    await bootstrap({ strapi });

    // Check that the warning about disabled configuration was logged
    const warnCalls = strapi.log.warn.mock.calls.map((call: any[]) => call[0]);
    expect(warnCalls).toContain('Audit logging is disabled in configuration');
    expect(strapi.documents.use).not.toHaveBeenCalled();
  });

  it('should handle missing database table gracefully', async () => {
    strapi.db.connection.schema.hasTable = jest.fn().mockResolvedValue(false);

    await bootstrap({ strapi });

    expect(strapi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Table audit_logs does not exist yet')
    );
  });

  it('should register lifecycle hooks', async () => {
    await bootstrap({ strapi });

    expect(strapi.documents.use).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle bootstrap errors', async () => {
    strapi.plugin = jest.fn(() => ({
      config: {
        enabled: true,
        excludeContentTypes: [],
      },
      service: jest.fn(() => ({
        registerPermissions: jest.fn().mockRejectedValue(new Error('Permission error')),
      })),
    }));

    await expect(bootstrap({ strapi })).rejects.toThrow();
    expect(strapi.log.error).toHaveBeenCalled();
  });
});
