# Hushh PDA API Guide

## Overview

This guide covers the API endpoints and features of the Personal Data Agents (PDAs) built with the Hushh Modular Consent Protocol.

## Core Concepts

### Consent Tokens
- Signed proofs of user permission
- Scoped to specific actions
- Time-bound and revocable
- Required for all operations

### Trust Links
- Agent-to-agent delegation
- Scoped permissions
- Time-limited access
- Cryptographically verified

### Vault Storage
- AES-256-GCM encryption
- Secure credential storage
- Zero plaintext data
- Per-user encryption keys

## Inbox Agent API

### Authentication

```http
GET /auth/gmail
Query Parameters:
- user_id: string (required)

Response:
{
    "auth_url": string  // Google OAuth URL
}
```

### Email Operations

```http
GET /emails
Query Parameters:
- token: string (required) - Consent token
- user_id: string (required)
- max_results: number (default: 5, max: 10)
- page_token: string (optional)

Response:
{
    "emails": [
        {
            "id": string,
            "subject": string,
            "from": string,
            "date": string,
            "snippet": string,
            "body": string,
            "hasAttachments": boolean
        }
    ],
    "pagination": {
        "has_more": boolean,
        "next_page_token": string,
        "emails_on_page": number,
        "max_results": number
    }
}
```

### AI Analysis

```http
POST /analyze
Body:
{
    "token": string,
    "user_id": string,
    "email_ids": string[],
    "analysis_type": string
}

Response:
{
    "insights": {
        "summary": string,
        "actionItems": string[],
        "keyTopics": string[],
        "priority": "high" | "medium" | "low",
        "sentiment": "positive" | "neutral" | "negative"
    }
}
```

### Content Generation

```http
POST /generate
Body:
{
    "token": string,
    "user_id": string,
    "email_ids": string[],
    "type": "summary" | "proposal" | "analysis",
    "custom_prompt": string
}

Response:
{
    "content": string
}
```

## Schedule Agent API

### Authentication

```http
GET /auth/google
Query Parameters:
- user_id: string (required)

Response:
{
    "auth_url": string  // Google Calendar OAuth URL
}
```

### Calendar Operations

```http
GET /calendar/events
Query Parameters:
- token: string (required)
- user_id: string (required)
- time_min: string (optional)
- time_max: string (optional)

Response:
{
    "items": [
        {
            "id": string,
            "summary": string,
            "start": { "dateTime": string },
            "end": { "dateTime": string }
        }
    ]
}
```

### Smart Scheduling

```http
POST /calendar/smart-create
Query Parameters:
- token: string (required)
- user_id: string (required)
- title: string (required)
- duration_minutes: number (default: 60)

Response:
{
    "event": {
        "id": string,
        "summary": string,
        "start": { "dateTime": string },
        "end": { "dateTime": string }
    },
    "ai_suggestion": {
        "suggested_time": string,
        "confidence": number,
        "reason": string,
        "alternatives": array
    }
}
```

### User Preferences

```http
GET /calendar/preferences
Query Parameters:
- token: string (required)
- user_id: string (required)

Response:
{
    "most_common_hour": number,
    "most_common_day": string,
    "avg_duration_minutes": number,
    "total_events": number,
    "hour_distribution": object,
    "day_distribution": object
}
```

## Agent-to-Agent Communication

### Message Types

1. `EMAIL_TO_EVENT`
   - Convert email content to calendar event
   - Required scopes: `GMAIL_READ`, `CALENDAR_WRITE`

2. `SCHEDULE_CONFLICT`
   - Notify about scheduling conflicts
   - Required scopes: `CALENDAR_READ`

3. `EMAIL_REMINDER`
   - Set email reminders based on calendar
   - Required scopes: `CALENDAR_READ`, `GMAIL_WRITE`

4. `CONTACT_SYNC`
   - Sync contact information
   - Required scopes: `GMAIL_READ`, `CALENDAR_WRITE`

### Example Usage

```python
# Establish trust between agents
trust_link = comm_system.establish_trust(
    from_agent="inbox_agent",
    to_agent="schedule_agent",
    user_id="user123",
    scopes=[ConsentScope.CALENDAR_WRITE]
)

# Send message
success = comm_system.send_message(
    from_agent="inbox_agent",
    to_agent="schedule_agent",
    user_id="user123",
    message_type="email_to_event",
    payload={
        "subject": "Team Meeting",
        "time": "2024-01-20T10:00:00Z"
    },
    required_scopes=[ConsentScope.CALENDAR_WRITE]
)
```

## Security Considerations

1. **Token Validation**
   - Always validate consent tokens before operations
   - Check scope matches the requested operation
   - Verify token hasn't expired

2. **Data Encryption**
   - Use vault for sensitive data storage
   - Encrypt all user credentials
   - Never log sensitive information

3. **Trust Links**
   - Validate trust links before agent communication
   - Check scope compatibility
   - Handle expired links gracefully

## Error Handling

All endpoints return standard HTTP status codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden (invalid/expired token)
- 404: Not Found
- 500: Internal Server Error

Error responses include:
```json
{
    "detail": "Error description"
}
```

## Best Practices

1. **Consent Management**
   - Always request minimal necessary scopes
   - Explain why each permission is needed
   - Make it easy to revoke access

2. **AI Usage**
   - Use AI responsibly and transparently
   - Respect user privacy in prompts
   - Handle AI errors gracefully

3. **Mobile Integration**
   - Support deep linking for auth flows
   - Optimize payload sizes
   - Handle offline scenarios

## Testing

Run the test suite:
```bash
pytest tests/
```

Key test areas:
- Token validation
- Agent communication
- AI integration
- Error handling
- Security measures 