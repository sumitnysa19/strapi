import permissionService from '../permission';

describe('Permission Service', () => {
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
      service: jest.fn((serviceName: string) => {
        if (serviceName === 'admin::permission') {
          return {
            engine: {
              generateUserAbility: jest.fn().mockResolvedValue({
                can: jest.fn().mockReturnValue(true),
              }),
            },
            actionProvider: {
              registerMany: jest.fn().mockResolvedValue(undefined),
            },
          };
        }
        if (serviceName === 'admin::role') {
          return {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 1,
                permissions: [{ action: 'plugin::audit-log.read' }],
              },
            ]),
          };
        }
        return {};
      }),
    };

    service = permissionService({ strapi });
  });

  describe('validateReadAccess', () => {
    it('should allow access for authenticated user with permission', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        roles: [{ id: 1 }],
      };

      await expect(service.validateReadAccess(user)).resolves.not.toThrow();
    });

    it('should deny access for unauthenticated user', async () => {
      await expect(service.validateReadAccess(null)).rejects.toThrow('Authentication required');
    });

    it('should deny access for user without permission', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        roles: [{ id: 1 }],
      };

      strapi.service = jest.fn((serviceName: string) => {
        if (serviceName === 'admin::permission') {
          return {
            engine: {
              generateUserAbility: jest.fn().mockResolvedValue({
                can: jest.fn().mockReturnValue(false),
              }),
            },
          };
        }
        if (serviceName === 'admin::role') {
          return {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 1,
                permissions: [],
              },
            ]),
          };
        }
        return {};
      });

      service = permissionService({ strapi });

      await expect(service.validateReadAccess(user)).rejects.toThrow('Insufficient permissions');
    });

    it('should deny access for user without roles', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
      };

      await expect(service.validateReadAccess(user)).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('registerPermissions', () => {
    it('should register permissions successfully', async () => {
      const registerManySpy = jest.fn().mockResolvedValue(undefined);
      
      strapi.service = jest.fn((serviceName: string) => {
        if (serviceName === 'admin::permission') {
          return {
            engine: {
              generateUserAbility: jest.fn().mockResolvedValue({
                can: jest.fn().mockReturnValue(true),
              }),
            },
            actionProvider: {
              registerMany: registerManySpy,
            },
          };
        }
        return {};
      });

      service = permissionService({ strapi });
      await service.registerPermissions();

      expect(registerManySpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            uid: 'read',
            pluginName: 'audit-log',
          }),
        ])
      );
    });

    it('should handle missing permission service gracefully', async () => {
      strapi.service = jest.fn(() => ({
        actionProvider: null,
      }));

      service = permissionService({ strapi });

      await expect(service.registerPermissions()).resolves.not.toThrow();
      expect(strapi.log.warn).toHaveBeenCalled();
    });
  });
});
