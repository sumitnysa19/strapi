# Strapi Audit Log Plugin

Automated audit logging for Strapi Content API operations with comprehensive compliance and security features.

## Overview

The Audit Log plugin automatically captures and stores detailed metadata for all content operations (create, update, delete) performed through the Content API. It provides comprehensive audit trails for compliance, security monitoring, and operational analysis without requiring any manual intervention or code changes.

## Features

- ✅ **Automatic Audit Logging**: Captures all content operations without manual intervention
- ✅ **Comprehensive Metadata**: Records user information, timestamps, payloads, and operation details
- ✅ **Configurable Exclusions**: Control what gets logged to optimize performance
- ✅ **REST API**: Query audit logs with flexible filtering, pagination, and sorting
- ✅ **Permission-Based Access**: Secure role-based access control for audit data
- ✅ **Non-Intrusive Design**: Audit failures never block content operations
- ✅ **Reliability Features**: Circuit breaker, retry logic, and fallback queue
- ✅ **Performance Optimized**: Async processing with minimal impact on API performance

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Usage](#api-usage)
- [Permissions](#permissions)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [License](#license)

## Installation

### As a Strapi Plugin

This plugin is designed to be part of the Strapi core. To install it in your Strapi project:

```bash
# Using npm
npm install @strapi/plugin-audit-log

# Using yarn
yarn add @strapi/plugin-audit-log
```

### Enable the Plugin

Add the plugin to your `config/plugins.js` (or `config/plugins.ts`):

```javascript
module.exports = {
  'audit-log': {
    enabled: true,
  }
};
```

### Database Migration

The plugin automatically creates the required `audit_logs` table on first startup. No manual migration is needed.

## Quick Start

### 1. Enable the Plugin

```javascript
// config/plugins.js
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [], // Optional: exclude specific content types
    }
  }
};
```

### 2. Configure Permissions

In the Strapi admin panel:
1. Go to **Settings** → **Roles**
2. Select a role (e.g., "Admin")
3. Find **Audit Log** under Plugins
4. Check **Read audit logs**
5. Save

### 3. Query Audit Logs

```bash
# Get recent audit logs
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=25" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Start Creating Content

All content operations are now automatically logged! Create, update, or delete any content through the Content API, and the audit log will capture it.

## Configuration

### Basic Configuration

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

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable audit logging globally |
| `excludeContentTypes` | string[] | `[]` | Content types to exclude from logging |
| `retentionDays` | number | `365` | Days to retain audit logs (informational) |
| `batchSize` | number | `100` | Batch size for queue processing |
| `asyncProcessing` | boolean | `true` | Process audit logs asynchronously |

### Environment Variables

```javascript
// config/plugins.js
module.exports = ({ env }) => ({
  'audit-log': {
    enabled: env.bool('AUDIT_LOG_ENABLED', true),
    config: {
      enabled: env.bool('AUDIT_LOG_ENABLED', true),
      excludeContentTypes: env.array('AUDIT_LOG_EXCLUDE', []),
      retentionDays: env.int('AUDIT_LOG_RETENTION_DAYS', 365),
    }
  }
});
```

Then in `.env`:
```bash
AUDIT_LOG_ENABLED=true
AUDIT_LOG_EXCLUDE=admin::user,plugin::upload.file
AUDIT_LOG_RETENTION_DAYS=365
```

### Example Configurations

**Production (High Security)**:
```javascript
{
  enabled: true,
  config: {
    enabled: true,
    excludeContentTypes: [],
    retentionDays: 2555, // 7 years for compliance
    asyncProcessing: true,
  }
}
```

**Development (Disabled)**:
```javascript
{
  enabled: false, // Disable in development
}
```

**High-Volume (Optimized)**:
```javascript
{
  enabled: true,
  config: {
    enabled: true,
    excludeContentTypes: [
      'api::analytics.event',
      'api::log.log',
    ],
    retentionDays: 90,
    batchSize: 200,
    asyncProcessing: true,
  }
}
```

For detailed configuration options, see [CONFIGURATION.md](./CONFIGURATION.md).

## API Usage

### Endpoint

```
GET /audit-log/audit-logs
```

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `contentType` | string | Filter by content type | `api::article.article` |
| `userId` | integer | Filter by user ID | `5` |
| `action` | string | Filter by action type | `create`, `update`, `delete` |
| `startDate` | string | Start date (ISO 8601) | `2024-01-01T00:00:00Z` |
| `endDate` | string | End date (ISO 8601) | `2024-12-31T23:59:59Z` |
| `page` | integer | Page number (min: 1) | `1` |
| `pageSize` | integer | Items per page (1-100) | `25` |
| `sort` | string | Sort order | `asc`, `desc` |

### Response Format

```json
{
  "data": [
    {
      "id": 1,
      "contentType": "api::article.article",
      "recordId": "123",
      "action": "update",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "userId": 1,
      "userEmail": "admin@example.com",
      "payload": {
        "type": "update",
        "changes": {
          "title": {
            "from": "Old Title",
            "to": "New Title"
          }
        },
        "updatedFields": ["title"]
      },
      "metadata": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "requestId": "req-123"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 10,
      "total": 250
    }
  }
}
```

### Usage Examples

**Get recent audit logs**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=1&pageSize=10&sort=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Filter by content type**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Filter by date range**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript/TypeScript**:
```javascript
async function getAuditLogs(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`http://localhost:1337/audit-log/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}

// Usage
const logs = await getAuditLogs({
  contentType: 'api::article.article',
  action: 'update',
  page: 1,
  pageSize: 25,
});
```

### Error Responses

**500 Internal Server Error**: Server error occurred
```json
{
  "error": {
    "status": 500,
    "message": "Internal server error"
  }
}
```

### Additional Examples

**Filter by user**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?userId=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Filter by action type**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?action=delete" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Combined filters**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?contentType=api::article.article&userId=5&action=update&startDate=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Pagination**:
```bash
curl -X GET "http://localhost:1337/audit-log/audit-logs?page=3&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Using Axios**:
```javascript
import axios from 'axios';

async function getAuditLogs(filters = {}) {
  try {
    const response = await axios.get('http://localhost:1337/audit-log/audit-logs', {
      params: filters,
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('Insufficient permissions');
    } else {
      console.error('Error fetching audit logs:', error.message);
    }
    throw error;
  }
}
```

## Permissions

### Permission System Overview

The plugin implements a comprehensive permission system that integrates with Strapi's built-in role-based access control (RBAC). Access to audit logs is controlled through a multi-layered security approach.

**Permission**: `plugin::audit-log.read`

### Permission Architecture

The permission system consists of four layers:

1. **Authentication Middleware**: Validates JWT token
2. **Auth Scope Check**: Route-level permission verification
3. **Permission Policy**: Middleware that validates user permissions
4. **Controller Validation**: Defense-in-depth validation in the handler

```plantuml
@startuml
!theme plain
skinparam backgroundColor white

actor "Client" as client
participant "Auth Middleware" as auth
participant "Auth Scope" as scope
participant "Permission Policy" as policy
participant "Controller" as controller
participant "Permission Service" as service
database "Database" as db

client -> auth: GET /audit-logs\n+ JWT Token
auth -> auth: Validate Token
auth -> auth: Load User

alt Token Invalid
  auth --> client: 401 Unauthorized
else Token Valid
  auth -> scope: Check Scope
  scope -> scope: Verify plugin::audit-log.read
  
  alt No Scope
    scope --> client: 403 Forbidden
  else Has Scope
    scope -> policy: Execute Policy
    policy -> service: validateReadAccess(user)
    service -> service: Check User Roles
    service -> service: Build Ability
    service -> service: Check Permission
    
    alt No Permission
      service --> client: 403 Forbidden
    else Has Permission
      policy -> controller: Execute Handler
      controller -> service: validateReadAccess(user)
      service -> service: Double Check
      
      alt Permission Denied
        service --> client: 403 Forbidden
      else Permission OK
        controller -> db: Query Audit Logs
        db --> controller: Return Data
        controller --> client: 200 OK + Data
      end
    end
  end
end

@enduml
```

### Configuring Permissions

#### Via Admin Panel

1. Navigate to **Settings** → **Roles** in the admin panel
2. Select a role (e.g., "Editor", "Admin")
3. Scroll to **Plugins** section
4. Find **Audit Log** plugin
5. Check **Read audit logs** permission
6. Save the role

#### Programmatically

```javascript
// Grant permission to a role
const roleService = strapi.service('admin::role');
const role = await roleService.findOne({ name: 'Editor' });

await roleService.assignPermissions(role.id, [
  {
    action: 'plugin::audit-log.read',
    subject: null,
  },
]);
```

### Permission Components

#### 1. Permission Service

**Methods**:
- `registerPermissions()`: Registers permissions during plugin bootstrap
- `validateReadAccess(user)`: Validates user has read permission

**Error Handling**:
- Throws 401 if user is not authenticated
- Throws 403 if user lacks required permission

#### 2. Permission Policy

Koa middleware that executes before controller handlers:

```typescript
// Applied to routes
{
  method: 'GET',
  path: '/audit-logs',
  handler: 'audit-log.find',
  config: {
    policies: ['plugin::audit-log.has-permission'],
  },
}
```

#### 3. Controller Validation

Defense-in-depth validation in the controller:

```typescript
async find(ctx: any) {
  // Validate permissions
  const permissionService = strapi.plugin('audit-log').service('permission');
  await permissionService.validateReadAccess(ctx.state.user);
  
  // Fetch and return audit logs
}
```

### Permission Errors

**401 Unauthorized**: User is not authenticated
```json
{
  "error": {
    "status": 401,
    "message": "Authentication required to access audit logs"
  }
}
```

**403 Forbidden**: User lacks required permission
```json
{
  "error": {
    "status": 403,
    "message": "Insufficient permissions to access audit logs"
  }
}
```

### Security Features

1. **Defense in Depth**: Multiple validation layers
2. **Audit Trail**: All permission denials are logged
3. **No Information Disclosure**: Generic error messages
4. **Integration**: Seamless integration with Strapi's RBAC
5. **Admin Panel**: Easy permission management through UI

### Testing Permissions

**Test without authentication**:
```bash
curl -X GET 'http://localhost:1337/audit-log/audit-logs'
# Expected: 401 Unauthorized
```

**Test with authentication but no permission**:
```bash
curl -X GET 'http://localhost:1337/audit-log/audit-logs' \
  -H 'Authorization: Bearer TOKEN_WITHOUT_PERMISSION'
# Expected: 403 Forbidden
```

**Test with proper permission**:
```bash
curl -X GET 'http://localhost:1337/audit-log/audit-logs' \
  -H 'Authorization: Bearer TOKEN_WITH_PERMISSION'
# Expected: 200 OK with audit log data
```

## Functional Requirements

The plugin implements the following functional requirements:

### 1. Automatic Audit Log Creation
- Automatically captures all content operations (create, update, delete) via Content API
- Records operation timestamp with millisecond precision
- Captures authenticated user identifier when available
- No manual intervention required

### 2. Comprehensive Metadata Capture
- **Content Type & Record ID**: Identifies what was changed
- **Create Operations**: Stores complete payload data
- **Update Operations**: Stores changed fields with before/after values
- **Delete Operations**: Stores complete record data before deletion
- **User Information**: Records user ID and email
- **Request Metadata**: Captures IP address, user agent, and request ID

### 3. Audit Log Storage
- Dedicated `audit_logs` database table
- Database indexes on content_type, user_id, action, and timestamp for performance
- Immutable entries (cannot be modified or deleted after creation)
- Graceful handling of database failures without blocking content operations

### 4. Audit Log Retrieval API
- REST API endpoint: `GET /audit-log/audit-logs`
- Filtering by content type, user, action, and date range
- Pagination support (page, pageSize)
- Sorting by timestamp (ascending/descending)
- Consistent JSON response format

### 5. Access Control
- Role-based access control using Strapi's RBAC system
- Permission: `plugin::audit-log.read`
- HTTP 403 Forbidden for unauthorized access
- Permission validation on every request
- Admin panel integration for role configuration

### 6. Configuration Management
- Global enable/disable setting
- Content type exclusion list
- Retention period configuration (informational)
- Batch size and async processing settings
- Configuration validation at startup

### 7. Error Handling and Reliability
- Non-blocking design: audit failures never block content operations
- Circuit breaker pattern for database connectivity issues
- Retry logic with exponential backoff for transient failures
- Fallback queue for buffering during outages
- Comprehensive error logging for troubleshooting

## Architecture

### High-Level Architecture

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam componentStyle rectangle
skinparam shadowing false
skinparam roundcorner 10

' Color scheme
skinparam rectangle {
  BackgroundColor<<client>> #E3F2FD
  BorderColor<<client>> #1976D2
  BackgroundColor<<core>> #E8F5E9
  BorderColor<<core>> #388E3C
  BackgroundColor<<plugin>> #FFF3E0
  BorderColor<<plugin>> #F57C00
  BackgroundColor<<critical>> #FFEBEE
  BorderColor<<critical>> #D32F2F
  BackgroundColor<<step>> #FFFDE7
  BorderColor<<step>> #F9A825
}

skinparam note {
  BackgroundColor #FFFEF7
  BorderColor #9E9E9E
  FontSize 11
}

skinparam database {
  BackgroundColor #F3E5F5
  BorderColor #7B1FA2
}

' Actors and Entry Point
actor "👤 Client" as client #E3F2FD
rectangle "**Content API Request**" as request <<client>> {
  note right
    POST/PUT/DELETE
    /api/content
  end note
}

' Strapi Core
package "🎯 **Strapi Core**" <<core>> {
  rectangle "**Document Service**\n**Middleware**" as middleware <<core>>
  rectangle "**Lifecycle Hooks**" as hooks <<core>> {
    note left
      ✓ beforeCreate / afterCreate
      ✓ beforeUpdate / afterUpdate
      ✓ beforeDelete / afterDelete
    end note
  }
}

' Audit Log Plugin
package "📝 **Audit Log Plugin**" <<plugin>> {
  rectangle "**Audit Service**" as service <<plugin>> {
    rectangle "**1.** Validate Config" as step1 <<step>>
    rectangle "**2.** Circuit Breaker" as step2 <<step>>
    rectangle "**3.** Build Entry" as step3 <<step>>
    rectangle "**4.** Retry Logic" as step4 <<step>>
    rectangle "**5.** Queue Fallback" as step5 <<step>>
  }
  
  rectangle "⚡ **Circuit Breaker**" as cb <<critical>>
  rectangle "🔄 **Retry Handler**" as retry <<critical>>
  rectangle "📮 **Fallback Queue**" as queue <<critical>>
}

' Database
database "💾 **Audit Logs DB**" as db {
  rectangle "audit_logs" as table #E1BEE7
  note bottom
    **Optimized Indexes:**
    • contentType (composite)
    • userId + timestamp
    • action + timestamp
    • timestamp (DESC)
  end note
}

' Connections
client -right-> request : "HTTP\nRequest"
request -right-> middleware : "process"
middleware -down-> hooks : "trigger"
hooks -down-> service : "**async**\n**non-blocking**" #Green

' Service flow
service -down-> step1
step1 -down-> step2
step2 -down-> step3
step3 -down-> step4
step4 -down-> step5

' Dependencies
step2 .right.> cb : "<<uses>>" #Orange
step4 .right.> retry : "<<uses>>" #Orange
step5 .right.> queue : "<<uses>>" #Orange

' Database write
service -right-> db : "**write audit**\n**entry**" #Purple

' Important notes
note left of service #FFEBEE
  ⚠️ **Error Handling**
  • All errors caught
  • Never blocks content ops
  • Graceful degradation
  • Silent failures logged
end note

note bottom of db #E8F5E9
  ✅ **Performance Features**
  • Write-optimized
  • Async operations
  • Batch processing
  • Auto-archival
end note

legend bottom
  |= Color |= Component Type |
  | <#E3F2FD> | Client Layer |
  | <#E8F5E9> | Strapi Core |
  | <#FFF3E0> | Audit Plugin |
  | <#FFEBEE> | Critical Components |
  | <#FFFDE7> | Processing Steps |
  | <#F3E5F5> | Database |
endlegend

@enduml
```

### Component Diagram

```plantuml
@startuml
!theme plain
skinparam backgroundColor white

package "Audit Log Plugin" {
  [Lifecycle Hooks] as hooks
  [Audit Service] as service
  [Permission Service] as permission
  [REST Controller] as controller
  
  package "Reliability Layer" {
    [Circuit Breaker] as cb
    [Retry Handler] as retry
    [Fallback Queue] as queue
    [Logger] as logger
  }
}

database "Database" {
  [audit_logs table] as table
}

[Strapi Core] --> hooks : intercepts operations
hooks --> service : createAuditEntry()
service --> cb : check state
service --> retry : handle failures
service --> queue : buffer entries
service --> logger : log operations
service --> table : write entries

[Client] --> controller : GET /audit-logs
controller --> permission : validateAccess()
controller --> service : findAuditLogs()
service --> table : query entries

note right of service
  Core business logic
  Configuration management
  Entry creation & retrieval
end note

note right of cb
  States: CLOSED, OPEN, HALF_OPEN
  Prevents cascading failures
end note

note right of queue
  In-memory buffer
  10,000 entry capacity
  Auto-flush every 30s
end note

@enduml
```

### Key Components

#### 1. Lifecycle Hook Integration
- **Purpose**: Automatically capture content operations without manual intervention
- **Implementation**: Document service middleware intercepts all content operations
- **Features**:
  - Captures before-state for updates and deletes
  - Extracts user context from request
  - Processes asynchronously using `process.nextTick()`
  - Never blocks content operations

#### 2. Audit Service
- **Purpose**: Core business logic for creating and retrieving audit logs
- **Key Methods**:
  - `createAuditEntry()`: Creates audit log entries with full error handling
  - `findAuditLogs()`: Retrieves audit logs with filtering and pagination
  - `isAuditingEnabled()`: Checks if auditing is enabled
  - `isContentTypeExcluded()`: Checks if content type should be logged
- **Features**:
  - Configuration validation and caching
  - Payload building for different action types
  - Metadata extraction from requests

#### 3. Circuit Breaker
- **Purpose**: Prevent cascading failures when database is unavailable
- **States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- **Configuration**:
  - Failure threshold: 5 failures
  - Reset timeout: 60 seconds
  - Monitoring window: 60 seconds
- **Behavior**:
  - Opens after 5 consecutive failures
  - Automatically attempts recovery after timeout
  - Prevents repeated database calls during outages

#### 4. Retry Logic
- **Purpose**: Handle transient database errors automatically
- **Strategy**: Exponential backoff with jitter
- **Configuration**:
  - Max retries: 3 attempts
  - Initial delay: 1 second
  - Max delay: 5 seconds
  - Backoff multiplier: 2x
- **Retryable Errors**: Connection errors, timeouts, deadlocks

#### 5. Fallback Queue
- **Purpose**: Buffer audit entries during database outages
- **Configuration**:
  - Max size: 10,000 entries
  - Flush interval: 30 seconds
  - Batch size: 100 entries per batch
- **Features**:
  - In-memory buffering
  - Automatic periodic flushing
  - Statistics tracking (size, processed, failed, dropped)
  - Graceful overflow handling

#### 6. Permission Service
- **Purpose**: Validate access control for audit data
- **Features**:
  - Integrates with Strapi's RBAC system
  - Registers `plugin::audit-log.read` permission
  - Validates permissions on every request
  - Defense-in-depth: policy + controller validation

#### 7. REST Controller
- **Purpose**: Handle API requests for audit log retrieval
- **Features**:
  - Query parameter parsing and validation
  - Filter building for complex queries
  - Pagination and sorting
  - Error handling and response formatting

### Data Flow

#### Audit Entry Creation Flow

```plantuml
@startuml
!theme plain
skinparam backgroundColor white

start
:Content Operation\n(e.g., article.update);
:Document Service Middleware;
:Capture Before-State\n(for updates/deletes);
:Execute Operation;
:Extract Operation Details;

fork
  :Return Operation Result\n(unaffected by audit);
  stop
fork again
  :Async Audit Entry Creation\n(process.nextTick);
  :Check Configuration;
  
  if (Circuit Breaker Open?) then (yes)
    :Queue Entry;
    :Log Queued;
    stop
  else (no)
    :Build Audit Entry;
    
    repeat
      :Attempt Database Write;
      
      if (Success?) then (yes)
        :Record Success;
        :Log Success;
        stop
      else (no)
        if (Retries Left?) then (yes)
          :Wait (Exponential Backoff);
        else (no)
          :Record Failure;
          :Queue Entry;
          :Log Failure;
          stop
        endif
      endif
    repeat while (Retry) is (yes)
  endif
end fork

note right
  All errors caught
  Never throws
  Non-blocking
end note

@enduml
```

#### Audit Log Retrieval Flow

```plantuml
@startuml
!theme plain
skinparam backgroundColor white

start
:API Request\nGET /audit-log/audit-logs?filters;
:Authentication Middleware;

if (Authenticated?) then (no)
  :Return 401 Unauthorized;
  stop
else (yes)
  :Permission Policy\n(has-permission);
  
  if (Has Permission?) then (no)
    :Return 403 Forbidden;
    stop
  else (yes)
    :Controller Handler;
    :Parse Query Parameters;
    :Validate Filters;
    :Build Database Query;
    
    partition "Database Query" {
      :Apply Filters\n(contentType, userId, action, dates);
      :Apply Pagination\n(page, pageSize);
      :Apply Sorting\n(timestamp asc/desc);
    }
    
    :Format Response;
    
    note right
      Response Structure:
      • data: Array of entries
      • meta: Pagination info
    end note
    
    :Return 200 OK;
    stop
  endif
endif

@enduml
```

### Non-Blocking Design

The plugin is designed to never block content operations:

1. **Async Processing**: Audit entries are created in `process.nextTick()` callback
2. **Try-Catch Wrapper**: All audit logic wrapped in try-catch
3. **Queue Fallback**: Failed entries are queued instead of throwing errors
4. **Circuit Breaker**: Prevents repeated failures from slowing down operations
5. **No Throws**: Service never throws errors, only logs them

### Implementation Summary

#### Reliability Features

**Circuit Breaker Pattern**:
- Three states: CLOSED, OPEN, HALF_OPEN
- Automatic failure detection and recovery
- Prevents cascading failures
- Configurable thresholds and timeouts

**Retry Logic with Exponential Backoff**:
- 3 retry attempts with increasing delays
- Jitter to prevent thundering herd
- Smart detection of retryable errors
- Detailed logging of retry attempts

**Fallback Queue System**:
- In-memory buffering (10,000 entries)
- Automatic periodic flushing (30 seconds)
- Batch processing (100 items per batch)
- Statistics tracking and monitoring

**Enhanced Logging**:
- Structured logging with context
- Operation lifecycle tracking
- Performance timing utilities
- Comprehensive error logging

#### Monitoring and Observability

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Check circuit breaker status
const cbStatus = auditService.getCircuitBreakerStatus();
// Returns: { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN', failureCount: number }

// Get queue statistics
const queueStats = auditService.getQueueStats();
// Returns: { size: number, processed: number, failed: number, dropped: number }

// Manually flush queue
await auditService.flushQueue();

// Reset circuit breaker
auditService.resetCircuitBreaker();
```

#### Configuration

All reliability features use sensible defaults:

```typescript
// Circuit Breaker
{
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,      // Try to close after 1 minute
  monitoringWindow: 60000   // Count failures in 1 minute window
}

// Retry Logic
{
  maxRetries: 3,
  initialDelay: 1000,       // 1 second
  maxDelay: 5000,           // 5 seconds
  backoffMultiplier: 2
}

// Queue
{
  maxSize: 10000,           // 10,000 entries
  flushInterval: 30000,     // 30 seconds
  batchSize: 100            // 100 entries per batch
}
```

## Troubleshooting

### Audit Logs Not Being Created

**Symptoms**: Content operations succeed but no audit logs appear

**Solutions**:
1. Check if plugin is enabled: `config.enabled = true`
2. Verify content type is not excluded in `excludeContentTypes`
3. Check Strapi logs for errors: `strapi.log`
4. Verify database table exists: `audit_logs`
5. Check circuit breaker status (see Monitoring section)

### Permission Denied (403)

**Symptoms**: API returns 403 Forbidden error

**Solutions**:
1. Verify user is authenticated (valid JWT token)
2. Check user's role has `plugin::audit-log.read` permission
3. Verify permission is assigned in admin panel
4. Check server logs for detailed error messages

### Performance Issues

**Symptoms**: Content API is slow after enabling audit logging

**Solutions**:
1. Ensure `asyncProcessing: true` in configuration
2. Exclude high-volume content types from logging
3. Check circuit breaker status for repeated failures
4. Monitor queue statistics for backlog
5. Review database indexes on `audit_logs` table

### Database Errors

**Symptoms**: Errors in logs about database writes failing

**Solutions**:
1. Check database connection and credentials
2. Verify `audit_logs` table exists and is accessible
3. Check database disk space
4. Review circuit breaker status
5. Check queue statistics for buffered entries

### Monitoring

Check system health programmatically:

```javascript
const auditService = strapi.plugin('audit-log').service('audit');

// Check circuit breaker status
const cbStatus = auditService.getCircuitBreakerStatus();
console.log('Circuit Breaker:', cbStatus);
// { state: 'CLOSED', failureCount: 0 }

// Check queue statistics
const queueStats = auditService.getQueueStats();
console.log('Queue Stats:', queueStats);
// { size: 0, processed: 1234, failed: 5, dropped: 0 }

// Manually flush queue
await auditService.flushQueue();

// Reset circuit breaker
auditService.resetCircuitBreaker();
```

For comprehensive troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Documentation

### Complete Documentation

- **[CONFIGURATION.md](./CONFIGURATION.md)** - Detailed configuration options and examples
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[EXAMPLES.md](./EXAMPLES.md)** - Real-world usage examples and patterns

## Requirements Satisfied

This plugin fully implements all requirements from the specification:

- ✅ **Requirement 1**: Automatic audit log creation for all content operations
- ✅ **Requirement 2**: Comprehensive metadata capture (user, timestamp, payload, changes)
- ✅ **Requirement 3**: Dedicated audit log storage with proper indexing
- ✅ **Requirement 4**: REST API with filtering, pagination, and sorting
- ✅ **Requirement 5**: Role-based access control with permission validation
- ✅ **Requirement 6**: Flexible configuration system
- ✅ **Requirement 7**: Robust error handling and reliability features

## Development Status

All core features are implemented and tested:

- ✅ Plugin structure and core interfaces
- ✅ Audit log content type and database schema
- ✅ Audit service with core logging functionality
- ✅ Lifecycle hooks for automatic audit capture
- ✅ Error handling and reliability features
- ✅ Audit log retrieval service and API
- ✅ Permission system and access control
- ✅ REST API controller and routes
- ✅ Plugin configuration and bootstrap logic
- ✅ Comprehensive test suite
- ✅ Documentation and examples

## Contributing

Contributions are welcome! Please follow the Strapi contribution guidelines.

## License

See LICENSE file in the root of the repository.

## Support

For issues, questions, or feature requests:
1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the [Documentation](#documentation)
3. Search existing issues on GitHub
4. Create a new issue with detailed information

## Acknowledgments

This plugin was built following Strapi's best practices and design patterns, with a focus on reliability, performance, and security.