# Audit Log Plugin Configuration

This document describes all configuration options for the Audit Log plugin.

## Configuration Location

Plugin configuration should be added to your Strapi project's `config/plugins.js` (or `config/plugins.ts` for TypeScript projects):

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [],
      retentionDays: 365,
      batchSize: 100,
      asyncProcessing: true,
    }
  }
};
```

## Configuration Options

### `enabled` (boolean)

**Default:** `true`

Globally enable or disable audit logging. When set to `false`, no audit entries will be created for any content operations.

```javascript
{
  enabled: false  // Disable all audit logging
}
```

**Requirements:** 6.1, 6.3

---

### `excludeContentTypes` (string[])

**Default:** `[]`

Array of content type UIDs to exclude from audit logging. Content types in this list will not have their operations logged.

```javascript
{
  excludeContentTypes: [
    'admin::user',              // Exclude admin users
    'plugin::users-permissions.user',  // Exclude regular users
    'api::temporary-data.temporary-data'  // Exclude temporary data
  ]
}
```

**Content Type UID Format:**
- Admin content types: `admin::<singular-name>`
- Plugin content types: `plugin::<plugin-name>.<singular-name>`
- API content types: `api::<api-name>.<singular-name>`

**Requirements:** 6.2, 6.4

---

### `retentionDays` (number)

**Default:** `365`

Number of days to retain audit log entries. This is informational and can be used by cleanup scripts or archival processes.

```javascript
{
  retentionDays: 90  // Retain logs for 90 days
}
```

**Note:** This plugin does not automatically delete old entries. You need to implement a cleanup process separately.

---

### `batchSize` (number)

**Default:** `100`

Maximum number of audit entries to process in a single batch when using the fallback queue system.

```javascript
{
  batchSize: 50  // Process 50 entries at a time
}
```

**Valid Range:** 1 - 1000

---

### `asyncProcessing` (boolean)

**Default:** `true`

Enable asynchronous processing of audit entries. When `true`, audit entries are created in the background without blocking content operations.

```javascript
{
  asyncProcessing: false  // Process audit entries synchronously
}
```

**Note:** Setting this to `false` may impact content API performance.

---

## Configuration Examples

### Minimal Configuration

Use all defaults:

```javascript
module.exports = {
  'audit-log': {
    enabled: true,
  }
};
```

### Production Configuration

Optimized for production with specific exclusions:

```javascript
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [
        'admin::user',
        'plugin::upload.file',  // Exclude file uploads
      ],
      retentionDays: 730,  // 2 years
      batchSize: 100,
      asyncProcessing: true,
    }
  }
};
```

### Development Configuration

Disabled for development:

```javascript
module.exports = {
  'audit-log': {
    enabled: false,  // Disable plugin entirely in development
  }
};
```

### High-Volume Configuration

Optimized for high-traffic applications:

```javascript
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [
        'api::analytics.event',  // Exclude high-volume content
        'api::log.log',
      ],
      retentionDays: 90,  // Shorter retention
      batchSize: 200,  // Larger batches
      asyncProcessing: true,
    }
  }
};
```

---

## Environment-Specific Configuration

You can use environment variables to control configuration:

```javascript
module.exports = ({ env }) => ({
  'audit-log': {
    enabled: env.bool('AUDIT_LOG_ENABLED', true),
    config: {
      enabled: env.bool('AUDIT_LOG_ENABLED', true),
      excludeContentTypes: env.array('AUDIT_LOG_EXCLUDE', []),
      retentionDays: env.int('AUDIT_LOG_RETENTION_DAYS', 365),
      batchSize: env.int('AUDIT_LOG_BATCH_SIZE', 100),
      asyncProcessing: env.bool('AUDIT_LOG_ASYNC', true),
    }
  }
});
```

Then in your `.env` file:

```bash
AUDIT_LOG_ENABLED=true
AUDIT_LOG_EXCLUDE=admin::user,plugin::upload.file
AUDIT_LOG_RETENTION_DAYS=365
AUDIT_LOG_BATCH_SIZE=100
AUDIT_LOG_ASYNC=true
```

---

## Configuration Validation

The plugin validates configuration on startup. Invalid configuration will cause the plugin to fail to load with a descriptive error message.

### Validation Rules

1. `enabled` must be a boolean
2. `excludeContentTypes` must be an array of non-empty strings
3. `retentionDays` must be a positive number (if provided)
4. `batchSize` must be a positive number between 1 and 1000 (if provided)
5. `asyncProcessing` must be a boolean (if provided)

### Example Validation Errors

```
Error: audit-log.enabled must be a boolean
Error: audit-log.excludeContentTypes must be an array
Error: audit-log.retentionDays must be a positive number
Error: audit-log.batchSize must not exceed 1000
```

---

## Runtime Configuration Access

The configuration is loaded during plugin bootstrap and can be accessed through the audit service:

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Check if auditing is enabled
const isEnabled = auditService.isAuditingEnabled();

// Check if a content type is excluded
const isExcluded = auditService.isContentTypeExcluded('api::article.article');
```

---

## Configuration Best Practices

1. **Exclude High-Volume Content Types:** If you have content types with very frequent updates (analytics, logs, etc.), consider excluding them to reduce database load.

2. **Set Appropriate Retention:** Balance compliance requirements with database size. Longer retention means more storage.

3. **Use Async Processing:** Keep `asyncProcessing: true` in production to avoid impacting content API performance.

4. **Environment-Specific Settings:** Use environment variables to have different configurations for development, staging, and production.

5. **Monitor Performance:** If you notice performance issues, check the circuit breaker status and queue statistics.

---

## Troubleshooting

### Audit Logs Not Being Created

1. Check if `enabled` is set to `true`
2. Verify the content type is not in `excludeContentTypes`
3. Check Strapi logs for configuration errors
4. Verify the audit-log content type exists in the database

### Performance Issues

1. Ensure `asyncProcessing` is set to `true`
2. Consider excluding high-volume content types
3. Check circuit breaker status: `auditService.getCircuitBreakerStatus()`
4. Monitor queue statistics: `auditService.getQueueStats()`

### Configuration Not Loading

1. Verify the configuration file path is correct
2. Check for syntax errors in the configuration file
3. Review Strapi startup logs for validation errors
4. Ensure the plugin is properly installed and enabled

---

## Related Documentation

- [API Reference](./API_REFERENCE.md) - API endpoints and usage
- [Permission System](./PERMISSION_SYSTEM.md) - Access control configuration
- [Implementation Notes](./IMPLEMENTATION_NOTES.md) - Technical details
