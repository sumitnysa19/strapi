/**
 * Enhanced Logging Utilities for Audit System
 * Provides structured logging with context for better troubleshooting
 */

export interface LogContext {
  contentType?: string;
  recordId?: string;
  action?: string;
  userId?: number;
  attempt?: number;
  error?: string;
  [key: string]: any;
}

/**
 * Log levels for audit system
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Enhanced logger for audit system
 * Wraps Strapi logger with additional context and formatting
 */
export class AuditLogger {
  private logger: any;
  private prefix: string;

  constructor(logger: any, prefix: string = '[Audit]') {
    this.logger = logger;
    this.prefix = prefix;
  }

  /**
   * Log debug message with context
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message with context
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message with context
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message with context
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log operation start
   */
  logOperationStart(operation: string, context?: LogContext): void {
    this.debug(`Starting ${operation}`, context);
  }

  /**
   * Log operation success
   */
  logOperationSuccess(operation: string, context?: LogContext): void {
    this.info(`${operation} completed successfully`, context);
  }

  /**
   * Log operation failure
   */
  logOperationFailure(operation: string, error: Error, context?: LogContext): void {
    this.error(`${operation} failed: ${error.message}`, {
      ...context,
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(attempt: number, maxRetries: number, error: Error, context?: LogContext): void {
    this.warn(`Retry attempt ${attempt}/${maxRetries} after error: ${error.message}`, {
      ...context,
      attempt,
      maxRetries,
      error: error.message,
    });
  }

  /**
   * Log circuit breaker state change
   */
  logCircuitBreakerStateChange(oldState: string, newState: string, context?: LogContext): void {
    this.warn(`Circuit breaker state changed: ${oldState} -> ${newState}`, context);
  }

  /**
   * Log queue operation
   */
  logQueueOperation(operation: string, queueSize: number, context?: LogContext): void {
    this.info(`Queue ${operation}: current size = ${queueSize}`, {
      ...context,
      queueSize,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, durationMs: number, context?: LogContext): void {
    this.debug(`${operation} took ${durationMs}ms`, {
      ...context,
      durationMs,
    });
  }

  /**
   * Core logging method with formatting
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(message, context);
    
    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        this.logger.info(formattedMessage);
        break;
      case LogLevel.WARN:
        this.logger.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        this.logger.error(formattedMessage);
        break;
    }
  }

  /**
   * Format log message with context
   */
  private formatMessage(message: string, context?: LogContext): string {
    let formatted = `${this.prefix} ${message}`;

    if (context && Object.keys(context).length > 0) {
      // Format context as key=value pairs
      const contextStr = Object.entries(context)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          if (typeof value === 'object') {
            return `${key}=${JSON.stringify(value)}`;
          }
          return `${key}=${value}`;
        })
        .join(' ');

      if (contextStr) {
        formatted += ` | ${contextStr}`;
      }
    }

    return formatted;
  }
}

/**
 * Create an audit logger instance
 */
export function createAuditLogger(strapiLogger: any): AuditLogger {
  return new AuditLogger(strapiLogger);
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private logger: AuditLogger;

  constructor(operation: string, logger: AuditLogger) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * End the timer and log performance
   */
  end(context?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.logPerformance(this.operation, duration, context);
    return duration;
  }
}
