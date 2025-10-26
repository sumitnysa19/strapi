# Audit Log Plugin - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Diagnostic Tools](#diagnostic-tools)
- [Error Messages](#error-messages)
- [Performance Issues](#performance-issues)
- [Configuration Problems](#configuration-problems)
- [Permission Issues](#permission-issues)
- [Database Issues](#database-issues)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Getting Help](#getting-help)

## Common Issues

### Issue 1: Audit Logs Not Being Created

**Symptoms**:
- Content operations succeed
- No audit log entries appear in database
- No errors in logs

**Possible Causes**:
1. Plugin is disabled
2. Content type is excluded from logging
3. Configuration error
4. Database table doesn't exist
5. Circuit breaker is open

**Solutions**:

**Step 1: Check if plugin is enabled**
```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,  // Must be true
    config: {
      enabled: true,  // Must also be true
    }
  }
};
```

**Step 2: Verify content type is not excluded**
```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    config: {
      excludeContentTypes: [
        // Make sure your content type is NOT in this list
        // 'api::article.article',  // Remove if you want to log articles
      ]
    }
  }
};
```

**Step 3: Check Strapi logs**
```bash
# Look for audit-related errors
tail -f logs/strapi.log | grep audit

# Or check console output when running Strapi
npm run develop
```

**Step 4: Verify database table exists**
```sql
-- For PostgreSQL
SELECT * FROM information_schema.tables WHERE table_name = 'audit_logs';

-- For MySQL
SHOW TABLES LIKE 'audit_logs';

-- For SQLite
SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs';
```

**Step 5: Check circuit breaker status**
```javascript
// In Strapi console or custom script
const auditService = strapi.plugin('audit-log').service('audit');
const status = auditService.getCircuitBreakerStatus();
console.log('Circuit Breaker Status:', status);

// If state is 'OPEN', reset it
if (status.state === 'OPEN') {
  auditService.resetCircuitBreaker();
  console.log('Circuit breaker reset');
}
```

---

### Issue 2: Permission Denied (403 Forbidden)

**Symptoms**:
- API returns 403 Forbidden error
- User is authenticated (has valid JWT token)
- Error message: "Insufficient permissions to access audit logs"

**Possible Causes**:
1. User's role doesn't have the required permission
2. Permission not properly registered
3. JWT token is for wrong user
4. Permission was revoked

**Solutions**:

**Step 1: Verify user authentication**
```bash
# Test with curl
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -v

# Look for 401 vs 403
# 401 = not authenticated
# 403 = authenticated but no permission
```

**Step 2: Check user's role and permissions**

In Strapi Admin Panel:
1. Go to **Settings** → **Roles**
2. Find the user's role
3. Scroll to **Plugins** section
4. Find **Audit Log**
5. Ensure **Read audit logs** is checked
6. Save the role

**Step 3: Verify permission is registered**
```javascript
// In Strapi console
const actions = await strapi.admin.services.permission.actionProvider.getAll();
const auditLogActions = actions.filter(a => a.pluginName === 'audit-log');
console.log('Audit Log Permissions:', auditLogActions);

// Should show: plugin::audit-log.read
```

**Step 4: Check server logs for details**
```bash
# Enable debug logging
DEBUG=strapi:* npm run develop

# Look for permission-related messages
tail -f logs/strapi.log | grep -i permission
```

**Step 5: Manually grant permission (if needed)**
```javascript
// In Strapi console or bootstrap script
const roleService = strapi.service('admin::role');
const role = await roleService.findOne({ name: 'Editor' });

await roleService.assignPermissions(role.id, [
  {
    action: 'plugin::audit-log.read',
    subject: null,
  },
]);

console.log('Permission granted to Editor role');
```

---

### Issue 3: 401 Unauthorized Error

**Symptoms**:
- API returns 401 Unauthorized
- Error message: "Authentication required to access audit logs"

**Possible Causes**:
1. No JWT token provided
2. Invalid JWT token
3. Expired JWT token
4. Wrong authentication header format

**Solutions**:

**Step 1: Verify JWT token is included**
```bash
# Correct format
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# NOT this (missing Bearer prefix)
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: YOUR_JWT_TOKEN"
```

**Step 2: Get a fresh JWT token**
```bash
# Login to get new token
curl -X POST "http://localhost:1337/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'

# Response will include JWT token
# {
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "user": { ... }
#   }
# }
```

**Step 3: Verify token is valid**
```javascript
// Decode JWT token (use jwt.io or jwt-decode library)
const jwt = require('jsonwebtoken');
const decoded = jwt.decode('YOUR_JWT_TOKEN');
console.log('Token payload:', decoded);
console.log('Expires at:', new Date(decoded.exp * 1000));

// Check if expired
if (Date.now() >= decoded.exp * 1000) {
  console.log('Token is expired');
}
```

---

### Issue 4: Performance Degradation

**Symptoms**:
- Content API is slower after enabling audit logging
- Increased response times
- Database load increased

**Possible Causes**:
1. Async processing is disabled
2. High-volume content types not excluded
3. Circuit breaker repeatedly failing
4. Queue backlog
5. Database performance issues

**Solutions**:

**Step 1: Ensure async processing is enabled**
```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    config: {
      asyncProcessing: true,  // Must be true for best performance
    }
  }
};
```

**Step 2: Exclude high-volume content types**
```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    config: {
      excludeContentTypes: [
        'api::analytics.event',  // High-volume analytics
        'api::log.log',          // Application logs
        'api::metric.metric',    // Metrics data
      ]
    }
  }
};
```

**Step 3: Check circuit breaker status**
```javascript
const auditService = strapi.plugin('audit-log').service('audit');
const status = auditService.getCircuitBreakerStatus();
console.log('Circuit Breaker:', status);

// If state is 'OPEN' and failureCount is high
if (status.state === 'OPEN') {
  console.log('Circuit breaker is open - audit logging is paused');
  console.log('Failures:', status.failureCount);
  
  // Investigate database issues before resetting
  // auditService.resetCircuitBreaker();
}
```

**Step 4: Check queue statistics**
```javascript
const auditService = strapi.plugin('audit-log').service('audit');
const stats = auditService.getQueueStats();
console.log('Queue Stats:', stats);

// If queue size is growing
if (stats.size > 1000) {
  console.log('Queue backlog detected');
  console.log('Size:', stats.size);
  console.log('Failed:', stats.failed);
  console.log('Dropped:', stats.dropped);
  
  // Manually flush queue
  await auditService.flushQueue();
}
```

**Step 5: Optimize database**
```sql
-- Check if indexes exist
-- PostgreSQL
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'audit_logs';

-- MySQL
SHOW INDEX FROM audit_logs;

-- Add missing indexes if needed
CREATE INDEX idx_audit_logs_content_type ON audit_logs(content_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

---

### Issue 5: Empty Results from API

**Symptoms**:
- API returns 200 OK
- Data array is empty
- No errors in logs

**Possible Causes**:
1. Filters are too restrictive
2. No matching data exists
3. Audit logging was recently enabled
4. Date range is incorrect

**Solutions**:

**Step 1: Test without filters**
```bash
# Get all audit logs (no filters)
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# If this returns data, your filters are too restrictive
```

**Step 2: Check each filter individually**
```bash
# Test content type filter
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test user filter
curl -X GET "http://localhost:1337/audit-log/audit-logs?userId=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test action filter
curl -X GET "http://localhost:1337/audit-log/audit-logs?action=create" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Step 3: Verify date format**
```bash
# Correct ISO 8601 format
curl -X GET "http://localhost:1337/audit-log/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# NOT this (missing time and timezone)
# startDate=2024-01-01
```

**Step 4: Check database directly**
```sql
-- Count total audit logs
SELECT COUNT(*) FROM audit_logs;

-- Check recent entries
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;

-- Check for specific content type
SELECT COUNT(*) FROM audit_logs WHERE content_type = 'api::article.article';
```

---

### Issue 6: Invalid Date Format Error

**Symptoms**:
- API returns 400 Bad Request
- Error message about invalid date format

**Possible Causes**:
1. Date not in ISO 8601 format
2. Missing timezone
3. Invalid date value

**Solutions**:

**Correct Date Formats**:
```bash
# ✅ Correct - Full ISO 8601 with timezone
startDate=2024-01-01T00:00:00Z
startDate=2024-01-01T00:00:00.000Z
startDate=2024-01-01T00:00:00-05:00

# ❌ Incorrect - Missing time
startDate=2024-01-01

# ❌ Incorrect - Missing timezone
startDate=2024-01-01T00:00:00

# ❌ Incorrect - Wrong format
startDate=01/01/2024
```

**JavaScript Example**:
```javascript
// Generate correct date format
const startDate = new Date('2024-01-01').toISOString();
const endDate = new Date('2024-12-31').toISOString();

console.log(startDate);  // 2024-01-01T00:00:00.000Z
console.log(endDate);    // 2024-12-31T00:00:00.000Z

// Use in API call
const params = new URLSearchParams({
  startDate,
  endDate,
  page: 1,
  pageSize: 25,
});

const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

---

## Diagnostic Tools

### 1. Check Plugin Status

```javascript
// In Strapi console or custom script
const plugin = strapi.plugin('audit-log');

if (!plugin) {
  console.log('❌ Plugin not loaded');
} else {
  console.log('✅ Plugin loaded');
  
  const auditService = plugin.service('audit');
  console.log('Auditing enabled:', auditService.isAuditingEnabled());
  
  const config = auditService.getConfig();
  console.log('Configuration:', config);
}
```

### 2. Monitor Circuit Breaker

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Get current status
const status = auditService.getCircuitBreakerStatus();
console.log('Circuit Breaker Status:', {
  state: status.state,           // CLOSED, OPEN, or HALF_OPEN
  failureCount: status.failureCount,
  isEnabled: status.state !== 'OPEN',
});

// Reset if needed
if (status.state === 'OPEN') {
  auditService.resetCircuitBreaker();
  console.log('Circuit breaker reset');
}
```

### 3. Monitor Queue

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Get queue statistics
const stats = auditService.getQueueStats();
console.log('Queue Statistics:', {
  currentSize: stats.size,
  totalProcessed: stats.processed,
  totalFailed: stats.failed,
  totalDropped: stats.dropped,
});

// Manually flush queue
await auditService.flushQueue();
console.log('Queue flushed');
```

### 4. Test Audit Entry Creation

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Manually create test audit entry
try {
  await auditService.createAuditEntry({
    contentType: 'api::test.test',
    recordId: '999',
    action: 'create',
    userId: 1,
    payload: {
      type: 'create',
      data: { test: true }
    },
    metadata: {
      ip: '127.0.0.1',
      userAgent: 'Test',
    }
  });
  console.log('✅ Test audit entry created successfully');
} catch (error) {
  console.log('❌ Failed to create test audit entry:', error.message);
}
```

### 5. Verify Database Connection

```javascript
// Test database query
try {
  const count = await strapi.db.query('plugin::audit-log.audit-log').count();
  console.log('✅ Database connection OK');
  console.log('Total audit logs:', count);
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
}
```

### 6. Check Permissions

```javascript
// Check if permission is registered
const actions = await strapi.admin.services.permission.actionProvider.getAll();
const auditLogActions = actions.filter(a => a.pluginName === 'audit-log');

if (auditLogActions.length === 0) {
  console.log('❌ No audit log permissions registered');
} else {
  console.log('✅ Permissions registered:', auditLogActions);
}

// Check user's permissions
const user = await strapi.db.query('admin::user').findOne({
  where: { id: 1 },
  populate: ['roles'],
});

console.log('User roles:', user.roles.map(r => r.name));
```

---

## Error Messages

### "Authentication required to access audit logs"

**Meaning**: No JWT token provided or token is invalid

**Solution**: Include valid JWT token in Authorization header
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### "Insufficient permissions to access audit logs"

**Meaning**: User doesn't have `plugin::audit-log.read` permission

**Solution**: Grant permission to user's role in admin panel

---

### "Circuit breaker is open"

**Meaning**: Too many database failures, audit logging temporarily disabled

**Solution**: 
1. Check database connection
2. Review database logs for errors
3. Reset circuit breaker after fixing issue

---

### "Queue is full, dropping oldest entries"

**Meaning**: Queue reached maximum size (10,000 entries)

**Solution**:
1. Check why queue isn't flushing
2. Verify database is accessible
3. Manually flush queue
4. Increase queue size if needed

---

### "Invalid configuration"

**Meaning**: Plugin configuration has errors

**Solution**: Review configuration and fix errors
```javascript
// Common configuration errors
{
  enabled: 'true',  // ❌ Should be boolean, not string
  enabled: true,    // ✅ Correct
  
  excludeContentTypes: 'api::article.article',  // ❌ Should be array
  excludeContentTypes: ['api::article.article'], // ✅ Correct
  
  retentionDays: '365',  // ❌ Should be number
  retentionDays: 365,    // ✅ Correct
}
```

---

## Performance Issues

### High Database Load

**Symptoms**: Database CPU/memory usage increased

**Solutions**:
1. Verify indexes exist on audit_logs table
2. Exclude high-volume content types
3. Implement archival strategy for old logs
4. Consider database partitioning

**Check Indexes**:
```sql
-- PostgreSQL
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'audit_logs';

-- MySQL
SHOW INDEX FROM audit_logs;
```

---

### Slow API Responses

**Symptoms**: Audit log API queries are slow

**Solutions**:
1. Use pagination (don't fetch all records)
2. Add date range filters
3. Optimize database queries
4. Check database performance

**Optimize Queries**:
```bash
# ❌ Bad - No pagination, no filters
curl -X GET "http://localhost:1337/audit-log/audit-logs"

# ✅ Good - Pagination and date filter
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=25&startDate=2024-01-01T00:00:00Z"
```

---

### Memory Usage Growing

**Symptoms**: Node.js process memory usage increasing

**Possible Causes**:
1. Queue is filling up
2. Memory leak in application code
3. Too many concurrent requests

**Solutions**:
1. Check queue statistics
2. Monitor circuit breaker
3. Flush queue manually
4. Restart Strapi if needed

---

## Configuration Problems

### Plugin Not Loading

**Check**:
1. Plugin is enabled in config/plugins.js
2. No syntax errors in configuration
3. Dependencies are installed
4. Strapi logs for errors

**Verify**:
```javascript
// In Strapi console
const plugin = strapi.plugin('audit-log');
console.log('Plugin loaded:', !!plugin);
```

---

### Configuration Not Applied

**Check**:
1. Configuration file path is correct
2. No syntax errors in configuration
3. Strapi was restarted after config change
4. Environment variables are set correctly

**Verify**:
```javascript
const auditService = strapi.plugin('audit-log').service('audit');
const config = auditService.getConfig();
console.log('Current configuration:', config);
```

---

## Permission Issues

### Permission Not Showing in Admin Panel

**Solutions**:
1. Verify plugin is loaded
2. Check permission registration in bootstrap
3. Restart Strapi
4. Clear browser cache

**Manually Register**:
```javascript
// In bootstrap.ts or console
const permissionService = strapi.plugin('audit-log').service('permission');
await permissionService.registerPermissions();
console.log('Permissions registered');
```

---

### Permission Granted But Still 403

**Check**:
1. User's role actually has the permission
2. JWT token is for the correct user
3. Permission action UID is correct
4. Server logs for detailed error

---

## Database Issues

### Table Not Created

**Solution**: Manually create table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  user_id INTEGER,
  user_email VARCHAR(255),
  payload JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_audit_logs_content_type ON audit_logs(content_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_content_type_timestamp ON audit_logs(content_type, timestamp);
```

---

### Database Connection Errors

**Check**:
1. Database is running
2. Connection credentials are correct
3. Database has sufficient resources
4. Network connectivity

**Test Connection**:
```javascript
try {
  await strapi.db.connection.raw('SELECT 1');
  console.log('✅ Database connection OK');
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
}
```

---

## Monitoring and Health Checks

### Health Check Endpoint

Create a custom endpoint to check plugin health:

```javascript
// In a custom controller or route
module.exports = {
  async health(ctx) {
    const auditService = strapi.plugin('audit-log').service('audit');
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        pluginLoaded: !!strapi.plugin('audit-log'),
        auditingEnabled: auditService.isAuditingEnabled(),
        circuitBreaker: auditService.getCircuitBreakerStatus(),
        queue: auditService.getQueueStats(),
      }
    };
    
    // Determine overall status
    if (health.checks.circuitBreaker.state === 'OPEN') {
      health.status = 'degraded';
    }
    
    if (health.checks.queue.size > 5000) {
      health.status = 'degraded';
    }
    
    ctx.body = health;
  }
};
```

---

### Logging

Enable detailed logging:

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    config: {
      // ... other config
      logLevel: 'debug',  // Enable debug logging
    }
  }
};
```

Check logs:
```bash
# Follow logs in real-time
tail -f logs/strapi.log | grep audit

# Search for errors
grep -i error logs/strapi.log | grep audit

# Search for specific content type
grep "api::article.article" logs/strapi.log
```

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review the [Documentation](./README.md)
3. Check Strapi logs for errors
4. Verify configuration is correct
5. Test with minimal configuration

### Information to Provide

When asking for help, include:

1. **Strapi Version**: `strapi version`
2. **Plugin Version**: Check package.json
3. **Database**: PostgreSQL, MySQL, SQLite, etc.
4. **Node Version**: `node --version`
5. **Configuration**: Your plugin configuration (redact sensitive data)
6. **Error Messages**: Full error messages from logs
7. **Steps to Reproduce**: What you did before the issue occurred
8. **Expected vs Actual**: What you expected vs what happened

### Diagnostic Report

Generate a diagnostic report:

```javascript
// Run in Strapi console
const auditService = strapi.plugin('audit-log').service('audit');

const report = {
  timestamp: new Date().toISOString(),
  strapi: {
    version: strapi.config.info.strapi,
    environment: strapi.config.environment,
  },
  plugin: {
    loaded: !!strapi.plugin('audit-log'),
    enabled: auditService.isAuditingEnabled(),
    config: auditService.getConfig(),
  },
  circuitBreaker: auditService.getCircuitBreakerStatus(),
  queue: auditService.getQueueStats(),
  database: {
    client: strapi.db.config.connection.client,
  }
};

console.log(JSON.stringify(report, null, 2));
```

### Support Channels

1. **GitHub Issues**: For bugs and feature requests
2. **Strapi Forum**: For general questions
3. **Discord**: For community support
4. **Documentation**: Check all documentation files

---

## Quick Reference

### Common Commands

```bash
# Check plugin status
strapi console
> strapi.plugin('audit-log')

# Check circuit breaker
> strapi.plugin('audit-log').service('audit').getCircuitBreakerStatus()

# Check queue
> strapi.plugin('audit-log').service('audit').getQueueStats()

# Flush queue
> await strapi.plugin('audit-log').service('audit').flushQueue()

# Reset circuit breaker
> strapi.plugin('audit-log').service('audit').resetCircuitBreaker()

# Count audit logs
> await strapi.db.query('plugin::audit-log.audit-log').count()

# Get recent logs
> await strapi.db.query('plugin::audit-log.audit-log').findMany({ limit: 10, orderBy: { timestamp: 'desc' } })
```

### Configuration Checklist

- [ ] Plugin enabled in config/plugins.js
- [ ] Configuration is valid (no syntax errors)
- [ ] Database table exists
- [ ] Indexes are created
- [ ] Permissions are registered
- [ ] User roles have required permissions
- [ ] Async processing is enabled
- [ ] High-volume content types are excluded (if needed)

### Health Check Checklist

- [ ] Plugin loads successfully
- [ ] Auditing is enabled
- [ ] Circuit breaker is CLOSED
- [ ] Queue size is reasonable (< 1000)
- [ ] No errors in logs
- [ ] Database connection is working
- [ ] Permissions are working
- [ ] API returns data

---

This troubleshooting guide covers the most common issues. If you encounter an issue not covered here, please check the other documentation files or reach out for support.
