import { AuditQueue } from '../queue';

describe('Audit Queue', () => {
  let queue: AuditQueue;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    queue = new AuditQueue({
      maxSize: 10,
      flushInterval: 1000,
      batchSize: 5,
    });
  });

  afterEach(() => {
    queue.stopAutoFlush();
  });

  describe('Enqueue Operations', () => {
    it('should enqueue items successfully', () => {
      const item = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: {},
      };

      const result = queue.enqueue(item);

      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });

    it('should reject items when queue is full', () => {
      const item = {
        contentType: 'api::article.article',
        recordId: '123',
        action: 'create' as const,
        payload: {},
      };

      // Fill the queue
      for (let i = 0; i < 10; i++) {
        queue.enqueue(item);
      }

      // Try to add one more
      const result = queue.enqueue(item);

      expect(result).toBe(false);
      expect(queue.size()).toBe(10);

      const stats = queue.getStats();
      expect(stats.dropped).toBe(1);
    });
  });

  describe('Flush Operations', () => {
    it('should flush items using processor', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      queue.setProcessor(processor);

      const items = [
        {
          contentType: 'api::article.article',
          recordId: '1',
          action: 'create' as const,
          payload: {},
        },
        {
          contentType: 'api::article.article',
          recordId: '2',
          action: 'create' as const,
          payload: {},
        },
      ];

      items.forEach(item => queue.enqueue(item));

      await queue.flush(mockLogger);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(queue.size()).toBe(0);
    });

    it('should handle processor errors gracefully', async () => {
      const processor = jest.fn().mockRejectedValue(new Error('Processing failed'));
      queue.setProcessor(processor);

      const item = {
        contentType: 'api::article.article',
        recordId: '1',
        action: 'create' as const,
        payload: {},
      };

      queue.enqueue(item);

      await queue.flush(mockLogger);

      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
    });

    it('should process items in batches', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      queue.setProcessor(processor);

      // Enqueue 7 items (batch size is 5)
      for (let i = 0; i < 7; i++) {
        queue.enqueue({
          contentType: 'api::article.article',
          recordId: String(i),
          action: 'create' as const,
          payload: {},
        });
      }

      // First flush processes 5 items
      await queue.flush(mockLogger);
      expect(processor).toHaveBeenCalledTimes(5);
      expect(queue.size()).toBe(2);

      // Second flush processes remaining 2 items
      await queue.flush(mockLogger);
      expect(processor).toHaveBeenCalledTimes(7);
      expect(queue.size()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track queue statistics', async () => {
      const processor = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      queue.setProcessor(processor);

      queue.enqueue({
        contentType: 'api::article.article',
        recordId: '1',
        action: 'create' as const,
        payload: {},
      });

      queue.enqueue({
        contentType: 'api::article.article',
        recordId: '2',
        action: 'create' as const,
        payload: {},
      });

      await queue.flush(mockLogger);

      const stats = queue.getStats();
      expect(stats.processed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('Auto Flush', () => {
    it('should auto-flush at intervals', async () => {
      const processor = jest.fn().mockResolvedValue(undefined);
      queue.setProcessor(processor);

      queue.enqueue({
        contentType: 'api::article.article',
        recordId: '1',
        action: 'create' as const,
        payload: {},
      });

      queue.startAutoFlush(mockLogger);

      // Wait for auto-flush interval
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(processor).toHaveBeenCalled();
      expect(queue.size()).toBe(0);
    });
  });
});
