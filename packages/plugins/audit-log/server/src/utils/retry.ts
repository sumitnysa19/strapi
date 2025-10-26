/**
 * Retry Logic with Exponential Backoff
 * Implements retry mechanism for transient failures
 */

export interface RetryConfig {
  maxRetries: number;        // Maximum number of retry attempts
  initialDelay: number;      // Initial delay in ms
  maxDelay: number;          // Maximum delay in ms
  backoffMultiplier: number; // Multiplier for exponential backoff
  retryableErrors?: string[]; // List of error types that should trigger retry
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,      // 1 second
  maxDelay: 10000,         // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
  ],
};

/**
 * Execute an operation with retry logic and exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: any
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    attempts = attempt;

    try {
      const result = await operation();
      
      if (logger) {
        logger.debug(`Operation succeeded on attempt ${attempt}`);
      }

      return {
        success: true,
        result,
        attempts,
      };
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(error, finalConfig.retryableErrors)) {
        if (logger) {
          logger.warn(`Non-retryable error encountered: ${error.message}`);
        }
        
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // Don't wait after the last attempt
      if (attempt < finalConfig.maxRetries) {
        const delay = calculateDelay(attempt, finalConfig);
        
        if (logger) {
          logger.debug(
            `Attempt ${attempt} failed, retrying in ${delay}ms. Error: ${error.message}`
          );
        }

        await sleep(delay);
      } else {
        if (logger) {
          logger.warn(
            `All ${finalConfig.maxRetries} retry attempts exhausted. Last error: ${error.message}`
          );
        }
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
  };
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  
  const delay = exponentialDelay + jitter;
  
  // Cap at max delay
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors?: string[]): boolean {
  if (!error) {
    return false;
  }

  // Check error code
  if (error.code && retryableErrors) {
    if (retryableErrors.includes(error.code)) {
      return true;
    }
  }

  // Check for database-specific errors
  if (error.message) {
    const message = error.message.toLowerCase();
    
    // Common transient database errors
    const transientPatterns = [
      'connection',
      'timeout',
      'deadlock',
      'lock wait timeout',
      'too many connections',
      'connection refused',
      'econnrefused',
      'etimedout',
    ];

    return transientPatterns.some(pattern => message.includes(pattern));
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with a simple retry count (no exponential backoff)
 */
export async function simpleRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  logger?: any
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (logger) {
        logger.debug(`Attempt ${attempt} failed: ${error.message}`);
      }

      if (attempt < maxRetries) {
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
