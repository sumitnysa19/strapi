/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by temporarily disabling operations when failures exceed threshold
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Number of failures before opening circuit
  resetTimeout: number;      // Time in ms before attempting to close circuit
  monitoringWindow?: number; // Time window for counting failures (ms)
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, rejecting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;
  private successCount: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      monitoringWindow: config.monitoringWindow || 60000, // Default 1 minute
    };
  }

  /**
   * Check if the circuit breaker allows operations
   */
  isEnabled(): boolean {
    const now = Date.now();

    // If circuit is open, check if we should transition to half-open
    if (this.state === CircuitState.OPEN) {
      if (now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // Circuit is closed or half-open, allow operation
    return true;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    const now = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // After successful operation in half-open state, close the circuit
      if (this.successCount >= 1) {
        this.close();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      // Only reset if failures are outside monitoring window
      if (now - this.lastFailureTime > this.config.monitoringWindow) {
        this.failureCount = 0;
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state, reopen circuit
      this.open();
      return;
    }

    // Reset failure count if outside monitoring window
    if (now - this.lastFailureTime > this.config.monitoringWindow) {
      this.failureCount = 0;
    }

    this.failureCount++;

    // Open circuit if failure threshold exceeded
    if (this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit (stop allowing operations)
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
  }

  /**
   * Close the circuit (resume normal operations)
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}
