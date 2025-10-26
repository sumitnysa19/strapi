# Audit Log Plugin - Usage Examples

## Table of Contents

- [Configuration Examples](#configuration-examples)
- [API Usage Examples](#api-usage-examples)
- [Integration Examples](#integration-examples)
- [Monitoring Examples](#monitoring-examples)
- [Advanced Use Cases](#advanced-use-cases)

## Configuration Examples

### Example 1: Basic Setup (Development)

Minimal configuration for development environment:

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
  }
};
```

This uses all default settings:
- Auditing enabled
- No content types excluded
- 365 days retention
- Async processing enabled

---

### Example 2: Production Setup (High Security)

Configuration for production with maximum audit coverage:

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [],  // Log everything
      retentionDays: 2555,      // 7 years for compliance
      batchSize: 100,
      asyncProcessing: true,
    }
  }
};
```

---

### Example 3: High-Volume Application

Optimized configuration for high-traffic applications:

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [
        'api::analytics.event',      // High-volume analytics
        'api::log.log',               // Application logs
        'api::metric.metric',         // Metrics data
        'api::session.session',       // Session data
        'plugin::upload.file',        // File uploads
      ],
      retentionDays: 90,              // Shorter retention
      batchSize: 200,                 // Larger batches
      asyncProcessing: true,
    }
  }
};
```

---

### Example 4: Environment-Based Configuration

Different settings for different environments:

```javascript
// config/plugins.js
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

Then in your `.env` files:

**Development (.env.development)**:
```bash
AUDIT_LOG_ENABLED=false
```

**Staging (.env.staging)**:
```bash
AUDIT_LOG_ENABLED=true
AUDIT_LOG_EXCLUDE=api::test.test
AUDIT_LOG_RETENTION_DAYS=90
```

**Production (.env.production)**:
```bash
AUDIT_LOG_ENABLED=true
AUDIT_LOG_EXCLUDE=api::analytics.event,api::log.log
AUDIT_LOG_RETENTION_DAYS=2555
AUDIT_LOG_BATCH_SIZE=200
```

---

### Example 5: Selective Auditing

Only audit specific content types:

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      // Exclude everything except what you want to audit
      excludeContentTypes: [
        // Exclude all plugin content types
        'plugin::*',
        // Exclude specific API content types
        'api::comment.comment',
        'api::like.like',
        'api::view.view',
        // Keep: api::article.article, api::user.user, etc.
      ],
    }
  }
};
```

---

## API Usage Examples

### Example 1: Get Recent Audit Logs

Fetch the 25 most recent audit logs:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=25&sort=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getRecentAuditLogs() {
  const response = await fetch('http://localhost:1337/audit-log/audit-logs?page=1&pageSize=25&sort=desc', {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  const data = await response.json();
  console.log('Recent audit logs:', data.data);
  return data;
}
```

---

### Example 2: Filter by Content Type

Get all audit logs for articles:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getArticleAuditLogs() {
  const params = new URLSearchParams({
    contentType: 'api::article.article',
    page: 1,
    pageSize: 50,
  });
  
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  return await response.json();
}
```

---

### Example 3: Filter by User

Get all changes made by a specific user:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?userId=5&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getUserActivity(userId) {
  const params = new URLSearchParams({
    userId: userId,
    page: 1,
    pageSize: 50,
    sort: 'desc',
  });
  
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  const data = await response.json();
  console.log(`User ${userId} activity:`, data.data);
  return data;
}
```

---

### Example 4: Filter by Action Type

Get all delete operations:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?action=delete&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getDeletedItems() {
  const params = new URLSearchParams({
    action: 'delete',
    page: 1,
    pageSize: 50,
    sort: 'desc',
  });
  
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  const data = await response.json();
  
  // Extract deleted items
  const deletedItems = data.data.map(log => ({
    contentType: log.contentType,
    recordId: log.recordId,
    deletedAt: log.timestamp,
    deletedBy: log.userEmail,
    data: log.payload.deletedData,
  }));
  
  return deletedItems;
}
```

---

### Example 5: Filter by Date Range

Get audit logs for January 2024:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&page=1&pageSize=100" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getAuditLogsForMonth(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    page: 1,
    pageSize: 100,
  });
  
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  return await response.json();
}

// Usage
const januaryLogs = await getAuditLogsForMonth(2024, 1);
```

---

### Example 6: Combined Filters

Get article updates by a specific user in a date range:

```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article&userId=5&action=update&startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript**:
```javascript
async function getArticleUpdatesByUser(userId, startDate, endDate) {
  const params = new URLSearchParams({
    contentType: 'api::article.article',
    userId: userId,
    action: 'update',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    page: 1,
    pageSize: 50,
  });
  
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
    },
  });
  
  const data = await response.json();
  
  // Extract what changed
  const changes = data.data.map(log => ({
    articleId: log.recordId,
    timestamp: log.timestamp,
    changes: log.payload.changes,
    updatedFields: log.payload.updatedFields,
  }));
  
  return changes;
}
```

---

### Example 7: Pagination

Fetch all audit logs with pagination:

```javascript
async function getAllAuditLogs() {
  const allLogs = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  
  while (hasMore) {
    const params = new URLSearchParams({
      page: page,
      pageSize: pageSize,
    });
    
    const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    });
    
    const data = await response.json();
    allLogs.push(...data.data);
    
    // Check if there are more pages
    hasMore = page < data.meta.pagination.pageCount;
    page++;
  }
  
  console.log(`Fetched ${allLogs.length} total audit logs`);
  return allLogs;
}
```

---

## Integration Examples

### Example 1: React Component

Display audit logs in a React component:

```jsx
import React, { useState, useEffect } from 'react';

function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    contentType: '',
    action: '',
    page: 1,
    pageSize: 25,
  });
  
  useEffect(() => {
    fetchAuditLogs();
  }, [filters]);
  
  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      
      const response = await fetch(
        `http://localhost:1337/audit-log/audit-logs?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setLogs(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Audit Logs</h1>
      
      {/* Filters */}
      <div>
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>
      
      {/* Audit Log Table */}
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Content Type</th>
            <th>Action</th>
            <th>User</th>
            <th>Record ID</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.contentType}</td>
              <td>{log.action}</td>
              <td>{log.userEmail || 'System'}</td>
              <td>{log.recordId}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Pagination */}
      <div>
        <button
          disabled={filters.page === 1}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          Previous
        </button>
        <span>Page {filters.page}</span>
        <button
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default AuditLogViewer;
```

---

### Example 2: Node.js Script

Export audit logs to CSV:

```javascript
const fs = require('fs');
const fetch = require('node-fetch');

async function exportAuditLogsToCSV(outputFile) {
  const allLogs = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  
  console.log('Fetching audit logs...');
  
  while (hasMore) {
    const params = new URLSearchParams({
      page: page,
      pageSize: pageSize,
    });
    
    const response = await fetch(
      `http://localhost:1337/audit-log/audit-logs?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
        },
      }
    );
    
    const data = await response.json();
    allLogs.push(...data.data);
    
    hasMore = page < data.meta.pagination.pageCount;
    page++;
    
    console.log(`Fetched page ${page - 1}...`);
  }
  
  console.log(`Total logs fetched: ${allLogs.length}`);
  
  // Convert to CSV
  const csvHeader = 'ID,Timestamp,Content Type,Record ID,Action,User ID,User Email\n';
  const csvRows = allLogs.map(log => 
    `${log.id},${log.timestamp},${log.contentType},${log.recordId},${log.action},${log.userId || ''},${log.userEmail || ''}`
  ).join('\n');
  
  const csv = csvHeader + csvRows;
  
  // Write to file
  fs.writeFileSync(outputFile, csv);
  console.log(`Exported to ${outputFile}`);
}

// Usage
exportAuditLogsToCSV('audit-logs.csv');
```

---

### Example 3: Monitoring Dashboard

Create a monitoring dashboard:

```javascript
async function getAuditStatistics() {
  // Fetch recent logs
  const response = await fetch(
    'http://localhost:1337/audit-log/audit-logs?page=1&pageSize=1000',
    {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    }
  );
  
  const data = await response.json();
  const logs = data.data;
  
  // Calculate statistics
  const stats = {
    total: data.meta.pagination.total,
    byAction: {
      create: logs.filter(l => l.action === 'create').length,
      update: logs.filter(l => l.action === 'update').length,
      delete: logs.filter(l => l.action === 'delete').length,
    },
    byContentType: {},
    byUser: {},
    recentActivity: logs.slice(0, 10),
  };
  
  // Group by content type
  logs.forEach(log => {
    stats.byContentType[log.contentType] = 
      (stats.byContentType[log.contentType] || 0) + 1;
  });
  
  // Group by user
  logs.forEach(log => {
    if (log.userEmail) {
      stats.byUser[log.userEmail] = 
        (stats.byUser[log.userEmail] || 0) + 1;
    }
  });
  
  return stats;
}

// Display statistics
async function displayDashboard() {
  const stats = await getAuditStatistics();
  
  console.log('=== Audit Log Dashboard ===');
  console.log(`Total Logs: ${stats.total}`);
  console.log('\nBy Action:');
  console.log(`  Create: ${stats.byAction.create}`);
  console.log(`  Update: ${stats.byAction.update}`);
  console.log(`  Delete: ${stats.byAction.delete}`);
  console.log('\nTop Content Types:');
  Object.entries(stats.byContentType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log('\nTop Users:');
  Object.entries(stats.byUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([user, count]) => {
      console.log(`  ${user}: ${count}`);
    });
}
```

---

## Monitoring Examples

### Example 1: Health Check Script

Monitor plugin health:

```javascript
async function checkAuditLogHealth() {
  const auditService = strapi.plugin('audit-log').service('audit');
  
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      pluginLoaded: !!strapi.plugin('audit-log'),
      auditingEnabled: auditService.isAuditingEnabled(),
      circuitBreaker: auditService.getCircuitBreakerStatus(),
      queue: auditService.getQueueStats(),
    },
  };
  
  // Determine overall status
  if (health.checks.circuitBreaker.state === 'OPEN') {
    health.status = 'degraded';
    health.issues = ['Circuit breaker is open'];
  }
  
  if (health.checks.queue.size > 5000) {
    health.status = 'degraded';
    health.issues = health.issues || [];
    health.issues.push('Queue backlog detected');
  }
  
  if (health.checks.queue.failed > 100) {
    health.status = 'unhealthy';
    health.issues = health.issues || [];
    health.issues.push('High failure rate');
  }
  
  return health;
}

// Run health check periodically
setInterval(async () => {
  const health = await checkAuditLogHealth();
  console.log('Audit Log Health:', health);
  
  if (health.status !== 'healthy') {
    // Send alert
    console.error('Audit log health check failed:', health.issues);
  }
}, 60000); // Every minute
```

---

### Example 2: Metrics Collection

Collect metrics for monitoring:

```javascript
async function collectAuditMetrics() {
  const auditService = strapi.plugin('audit-log').service('audit');
  
  const metrics = {
    timestamp: Date.now(),
    circuitBreaker: auditService.getCircuitBreakerStatus(),
    queue: auditService.getQueueStats(),
    database: {
      totalLogs: await strapi.db.query('plugin::audit-log.audit-log').count(),
    },
  };
  
  // Calculate rates
  const recentLogs = await strapi.db.query('plugin::audit-log.audit-log').findMany({
    where: {
      timestamp: {
        $gte: new Date(Date.now() - 60000), // Last minute
      },
    },
  });
  
  metrics.rates = {
    logsPerMinute: recentLogs.length,
    createRate: recentLogs.filter(l => l.action === 'create').length,
    updateRate: recentLogs.filter(l => l.action === 'update').length,
    deleteRate: recentLogs.filter(l => l.action === 'delete').length,
  };
  
  return metrics;
}

// Export metrics to monitoring system
async function exportMetrics() {
  const metrics = await collectAuditMetrics();
  
  // Send to monitoring system (e.g., Prometheus, CloudWatch, etc.)
  console.log('Audit Log Metrics:', JSON.stringify(metrics));
  
  // Or write to file
  fs.appendFileSync('audit-metrics.log', JSON.stringify(metrics) + '\n');
}

// Collect metrics every minute
setInterval(exportMetrics, 60000);
```

---

## Advanced Use Cases

### Example 1: Audit Trail for Specific Record

Get complete audit trail for a specific article:

```javascript
async function getRecordAuditTrail(contentType, recordId) {
  const params = new URLSearchParams({
    contentType: contentType,
    page: 1,
    pageSize: 100,
    sort: 'asc', // Chronological order
  });
  
  const response = await fetch(
    `http://localhost:1337/audit-log/audit-logs?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    }
  );
  
  const data = await response.json();
  
  // Filter by record ID
  const trail = data.data.filter(log => log.recordId === recordId);
  
  // Format trail
  const formattedTrail = trail.map(log => ({
    timestamp: log.timestamp,
    action: log.action,
    user: log.userEmail,
    changes: log.payload.changes || log.payload.data || log.payload.deletedData,
  }));
  
  return formattedTrail;
}

// Usage
const trail = await getRecordAuditTrail('api::article.article', '123');
console.log('Article 123 audit trail:', trail);
```

---

### Example 2: Detect Suspicious Activity

Monitor for suspicious patterns:

```javascript
async function detectSuspiciousActivity() {
  const params = new URLSearchParams({
    page: 1,
    pageSize: 1000,
    sort: 'desc',
  });
  
  const response = await fetch(
    `http://localhost:1337/audit-log/audit-logs?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    }
  );
  
  const data = await response.json();
  const logs = data.data;
  
  // Detect patterns
  const alerts = [];
  
  // 1. High delete rate
  const recentDeletes = logs.filter(l => 
    l.action === 'delete' && 
    new Date(l.timestamp) > new Date(Date.now() - 3600000) // Last hour
  );
  
  if (recentDeletes.length > 50) {
    alerts.push({
      type: 'high_delete_rate',
      message: `${recentDeletes.length} deletes in the last hour`,
      severity: 'high',
    });
  }
  
  // 2. Bulk operations by single user
  const userActivity = {};
  logs.forEach(log => {
    if (log.userId) {
      userActivity[log.userId] = (userActivity[log.userId] || 0) + 1;
    }
  });
  
  Object.entries(userActivity).forEach(([userId, count]) => {
    if (count > 100) {
      alerts.push({
        type: 'bulk_operations',
        message: `User ${userId} performed ${count} operations`,
        severity: 'medium',
      });
    }
  });
  
  // 3. After-hours activity
  const afterHours = logs.filter(log => {
    const hour = new Date(log.timestamp).getHours();
    return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
  });
  
  if (afterHours.length > 20) {
    alerts.push({
      type: 'after_hours_activity',
      message: `${afterHours.length} operations outside business hours`,
      severity: 'low',
    });
  }
  
  return alerts;
}

// Run detection periodically
setInterval(async () => {
  const alerts = await detectSuspiciousActivity();
  
  if (alerts.length > 0) {
    console.log('Suspicious activity detected:', alerts);
    // Send notifications
  }
}, 300000); // Every 5 minutes
```

---

### Example 3: Compliance Report

Generate compliance report:

```javascript
async function generateComplianceReport(startDate, endDate) {
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    page: 1,
    pageSize: 10000, // Adjust as needed
  });
  
  const response = await fetch(
    `http://localhost:1337/audit-log/audit-logs?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    }
  );
  
  const data = await response.json();
  const logs = data.data;
  
  const report = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: {
      totalOperations: logs.length,
      creates: logs.filter(l => l.action === 'create').length,
      updates: logs.filter(l => l.action === 'update').length,
      deletes: logs.filter(l => l.action === 'delete').length,
    },
    byContentType: {},
    byUser: {},
    criticalOperations: [],
  };
  
  // Group by content type
  logs.forEach(log => {
    if (!report.byContentType[log.contentType]) {
      report.byContentType[log.contentType] = {
        creates: 0,
        updates: 0,
        deletes: 0,
      };
    }
    report.byContentType[log.contentType][log.action + 's']++;
  });
  
  // Group by user
  logs.forEach(log => {
    if (log.userEmail) {
      if (!report.byUser[log.userEmail]) {
        report.byUser[log.userEmail] = {
          creates: 0,
          updates: 0,
          deletes: 0,
        };
      }
      report.byUser[log.userEmail][log.action + 's']++;
    }
  });
  
  // Identify critical operations (deletes)
  report.criticalOperations = logs
    .filter(l => l.action === 'delete')
    .map(l => ({
      timestamp: l.timestamp,
      contentType: l.contentType,
      recordId: l.recordId,
      user: l.userEmail,
    }));
  
  return report;
}

// Generate monthly report
const startDate = new Date(2024, 0, 1); // January 1, 2024
const endDate = new Date(2024, 0, 31, 23, 59, 59); // January 31, 2024
const report = await generateComplianceReport(startDate, endDate);

console.log('Compliance Report:', JSON.stringify(report, null, 2));
```

---

### Example 4: Data Recovery

Recover deleted data from audit logs:

```javascript
async function recoverDeletedRecord(contentType, recordId) {
  const params = new URLSearchParams({
    contentType: contentType,
    action: 'delete',
    page: 1,
    pageSize: 100,
  });
  
  const response = await fetch(
    `http://localhost:1337/audit-log/audit-logs?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    }
  );
  
  const data = await response.json();
  
  // Find the delete operation for this record
  const deleteLog = data.data.find(log => log.recordId === recordId);
  
  if (!deleteLog) {
    throw new Error(`No delete log found for ${contentType}:${recordId}`);
  }
  
  // Extract deleted data
  const deletedData = deleteLog.payload.deletedData;
  
  console.log('Deleted data:', deletedData);
  console.log('Deleted at:', deleteLog.timestamp);
  console.log('Deleted by:', deleteLog.userEmail);
  
  // Optionally recreate the record
  // const recreated = await strapi.db.query(contentType).create({
  //   data: deletedData,
  // });
  
  return {
    deletedData,
    deletedAt: deleteLog.timestamp,
    deletedBy: deleteLog.userEmail,
  };
}

// Usage
const recovered = await recoverDeletedRecord('api::article.article', '123');
console.log('Recovered data:', recovered);
```

---

These examples demonstrate the flexibility and power of the Audit Log plugin. You can adapt them to your specific use cases and requirements.
