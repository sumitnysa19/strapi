# Audit Log Reliability Utilities

This directory contains utility modules that implement error handling and reliability features for the audit logging system.

## Overview

The audit logging system is designed to be highly reliable and non-intrusive. It should never block content operations, even when the database is unavailable or under heavy load. These utilities implement several patterns to achieve this goal:

1. **Circuit Breaker Pattern** - Prevents cascading failures
2. **Retry Logic with Exponential Backoff** - Handles transient failures
3. **Fallback Queue System** - Buffers entries during outages
4. **Enhanced Logging** - Provides detailed troubleshooting information

## Modules

### circuit-breaker.ts

Implements the Circuit Breaker pattern to prevent cascading failures when the database is unavailable.

**Key Features:**
- Three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- Configurable failure threshold and reset timeout
- Automatic state transitions based on success/failure patterns
- Monitoring window for counting failures

**Usage:**
```typescript
const breaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,      // Try to close after 1 minute
  monitoringWindow: 60000   // Count failures in 1 minute window
});

if (breaker.isEnabled()) {
  try {
    await performOperation();
    breaker.recordSuccess();
  } catch (error) {
    breaker.recordFailure();
  }
}
```

**States:**
- `CLOSED`: Normal operation, all requests allowed
- `OPEN`: Circuit is open, requests are rejected (queued instead)
- `HALF_OPEN`: Testing if service recovered, limited requests allowed

### retry.ts

Implements retry logic with exponential backoff for handling transient failures.

**Key Features:**
- Configurable retry attempts and delays
- Exponential backoff with jitter to prevent thundering herd
- Retryable error detection (connection errors, timeouts, etc.)
- Detailed retry attempt logging

**Usage:**
```typescript
const result = await retryWithBackoff(
  async () => {
    await databaseOperation();
  },
  {
    maxRetries: 3,
    initialDelay: 1000,      // Start with 1 second
    maxDelay: 10000,         // Cap at 10 seconds
    backoffMultiplier: 2     // Double delay each time
  },
  logger
);

if (result.success) {
  console.log('Operation succeeded after', result.attempts, 'attempts');
} else {
  console.error('Operation failed:', result.error);
}
```

**Retryable Errors:**
- Connection errors (ECONNREFUSED, ETIMEDOUT, etc.)
- Database deadlocks and lock timeouts
- Transient network issues

### queue.ts

Implements a fallback queue system for buffering audit entries when the database is unavailable.

**Key Features:**
- In-memory queue with configurable size limits
- Automatic periodic flushing
- Batch processing for efficiency
- Queue statistics for monitoring
- Graceful handling of queue overflow

**Usage:**
```typescript
const queue = new AuditQueue({
  maxSize: 10000,          // Maximum queue size
  flushInterval: 30000,    // Flush every 30 seconds
  batchSize: 100           // Process 100 items per flush
});

// Set processor function
queue.setProcessor(async (params) => {
  await createAuditEntry(params);
});

// Start automatic flushing
queue.startAutoFlush(logger);

// Enqueue items
const queued = queue.enqueue(auditParams);
if (!queued) {
  console.error('Queue is full');
}

// Get statistics
const stats = queue.getStats();
console.log('Queue size:', stats.size);
console.log('Processed:', stats.processed);
console.log('Failed:', stats.failed);
console.log('Dropped:', stats.dropped);
```

**Queue Statistics:**
- `size`: Current number of items in queue
- `processed`: Total items successfully processed
- `failed`: Total items that failed processing
- `dropped`: Total items dropped due to queue overflow

### logger.ts

Provides enhanced logging with structured context for better troubleshooting.

**Key Features:**
- Structured logging with context
- Operation lifecycle logging (start, success, failure)
- Performance timing
- Circuit breaker and queue operation logging
- Formatted output with key=value pairs

**Usage:**
```typescript
const logger = createAuditLogger(strapi.log);

// Basic logging
logger.info('Operation started', {
  contentType: 'api::article.article',
  recordId: '123',
  action: 'create'
});

// Operation lifecycle
logger.logOperationStart('createAuditEntry', context);
logger.logOperationSuccess('createAuditEntry', context);
logger.logOperationFailure('createAuditEntry', error, context);

// Retry attempts
logger.logRetryAttempt(2, 3, error, context);

// Circuit breaker state changes
logger.logCircuitBreakerStateChange('CLOSED', 'OPEN', context);

// Queue operations
logger.logQueueOperation('enqueued', queueSize, context);

// Performance timing
const timer = new PerformanceTimer('databaseWrite', logger);
await performOperation();
timer.end(context); // Logs duration
```

## Integration

These utilities are integrated into the audit service (`services/audit.ts`) to provide comprehensive error handling:

1. **Circuit Breaker** checks if database operations should be attempted
2. **Retry Logic** handles transient failures with exponential backoff
3. **Fallback Queue** buffers entries when circuit breaker is open or retries fail
4. **Enhanced Logger** provides detailed troubleshooting information

## Error Handling Flow

```
Content Operation
    ↓
Audit Entry Creation
    ↓
Circuit Breaker Check
    ↓
├─ OPEN → Queue Entry
│
└─ CLOSED/HALF_OPEN
    ↓
    Retry with Backoff
    ↓
    ├─ Success → Record Success
    │
    └─ Failure → Record Failure + Queue Entry
```

## Monitoring

The audit service exposes methods for monitoring the reliability features:

```typescript
// Get circuit breaker status
const status = auditService.getCircuitBreakerStatus();
console.log('State:', status.state);
console.log('Failures:', status.failureCount);

// Get queue statistics
const stats = auditService.getQueueStats();
console.log('Queue size:', stats.size);
console.log('Processed:', stats.processed);
console.log('Failed:', stats.failed);
console.log('Dropped:', stats.dropped);

// Manually flush queue
await auditService.flushQueue();

// Reset circuit breaker
auditService.resetCircuitBreaker();
```

## Configuration

The reliability features use sensible defaults but can be customized:

**Circuit Breaker:**
- Failure Threshold: 5 failures
- Reset Timeout: 60 seconds
- Monitoring Window: 60 seconds

**Retry Logic:**
- Max Retries: 3 attempts
- Initial Delay: 1 second
- Max Delay: 5 seconds
- Backoff Multiplier: 2x

**Queue:**
- Max Size: 10,000 entries
- Flush Interval: 30 seconds
- Batch Size: 100 entries (or configured batchSize)

## Best Practices

1. **Never Block Content Operations**: All error handling is designed to fail gracefully without blocking content operations.

2. **Monitor Queue Size**: If the queue consistently grows, it indicates persistent database issues that need attention.

3. **Watch Circuit Breaker State**: Frequent OPEN states indicate reliability issues that should be investigated.

4. **Review Logs**: The enhanced logger provides detailed context for troubleshooting issues.

5. **Graceful Shutdown**: The system automatically flushes the queue on shutdown to minimize data loss.

## Testing

When testing the reliability features:

1. Test circuit breaker by simulating database failures
2. Test retry logic with transient errors
3. Test queue overflow scenarios
4. Test graceful degradation under load
5. Verify no content operations are blocked by audit failures

## Troubleshooting

**Circuit Breaker Stuck Open:**
- Check database connectivity
- Review error logs for root cause
- Manually reset if needed: `auditService.resetCircuitBreaker()`

**Queue Growing:**
- Check circuit breaker state
- Verify database is accessible
- Manually flush: `await auditService.flushQueue()`
- Check queue stats: `auditService.getQueueStats()`

**High Failure Rate:**
- Review retry logs for error patterns
- Check database performance
- Verify network connectivity
- Consider increasing retry delays

## Requirements Satisfied

This implementation satisfies the following requirements:

- **7.1**: Graceful error handling that doesn't block content operations
- **7.2**: Retry logic for transient database failures
- **7.3**: Meaningful error messages for configuration issues
- **7.4**: Content operations continue when audit database is unavailable
- **7.5**: Circuit breaker pattern for database connectivity issues
- **3.4**: Graceful handling of database storage failures
