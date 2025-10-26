import { CircuitBreaker, CircuitState } from '../circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 1000,
    });
  });

  describe('State Management', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.isEnabled()).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.isEnabled()).toBe(false);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Calling isEnabled() triggers the state transition
      const enabled = breaker.isEnabled();
      
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(enabled).toBe(true);
    });

    it('should transition back to CLOSED on success in HALF_OPEN', async () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger transition to HALF_OPEN
      breaker.isEnabled();
      
      breaker.recordSuccess();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getFailureCount()).toBe(0);
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      await new Promise(resolve => setTimeout(resolve, 1100));

      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Failure Tracking', () => {
    it('should track failure count correctly', () => {
      expect(breaker.getFailureCount()).toBe(0);

      breaker.recordFailure();
      expect(breaker.getFailureCount()).toBe(1);

      breaker.recordFailure();
      expect(breaker.getFailureCount()).toBe(2);
    });

    it('should not reset failure count immediately on success in CLOSED state', () => {
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getFailureCount()).toBe(2);

      breaker.recordSuccess();

      // Failure count is not reset immediately in CLOSED state
      // It's only reset after monitoring window or when circuit closes from HALF_OPEN
      expect(breaker.getFailureCount()).toBe(2);
    });
  });

  describe('Manual Reset', () => {
    it('should reset to CLOSED state', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.isEnabled()).toBe(true);
    });
  });
});
