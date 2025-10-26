import { retryWithBackoff } from '../retry';

describe('Retry with Backoff', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
      retryableErrors: [], // Empty list means all errors are retryable
    }, mockLogger);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    // Use retryable errors (connection errors)
    const error1 = new Error('connection refused');
    const error2 = new Error('timeout occurred');
    
    const operation = jest.fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    }, mockLogger);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('connection timeout'));

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    }, mockLogger);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.error).toBeInstanceOf(Error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should apply exponential backoff', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockResolvedValue('success');

    const startTime = Date.now();

    await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 50,
      maxDelay: 500,
      backoffMultiplier: 2,
    }, mockLogger);

    const duration = Date.now() - startTime;

    // Should take at least 50ms (first retry delay)
    expect(duration).toBeGreaterThanOrEqual(40);
  });

  it('should respect max delay', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockResolvedValue('success');

    const startTime = Date.now();

    await retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 100,
      backoffMultiplier: 2,
    }, mockLogger);

    const duration = Date.now() - startTime;

    // Max delay should cap the wait time - should be around 200ms (2 retries * 100ms max)
    expect(duration).toBeLessThan(400);
  });
});
