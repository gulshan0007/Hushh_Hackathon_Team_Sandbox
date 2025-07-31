# Google Calendar Setup Guide

## Issue: Expired Calendar Tokens

The Google Calendar tokens in your environment have expired, causing 401 errors when trying to access the Google Calendar API. This is a common issue with OAuth tokens that have a limited lifespan.

## Solution: Complete OAuth Flow

### Step 1: Complete Google Calendar OAuth

1. **Start the OAuth flow** by visiting:
   ```
   https://your-backend-url/schedule-agent/auth/google?user_id=your_user_id
   ```

2. **Follow the OAuth flow** in your browser:
   - Grant permissions to your Google Calendar
   - You'll be redirected back to your app

3. **Check the server logs** for the new tokens:
   ```
   ============================================================
   📝 IMPORTANT: Update your .env file with these tokens:
   ============================================================
   GOOGLE_CALENDAR_TOKEN=your_new_access_token
   GOOGLE_CALENDAR_REFRESH_TOKEN=your_new_refresh_token
   ============================================================
   💡 After updating .env, restart the server to use real calendar data
   ============================================================
   ```

### Step 2: Update Environment Variables

**Option A: Manual Update**
1. Copy the tokens from the server logs
2. Update your `.env` file with the new tokens
3. Restart the server

**Option B: Use Helper Script**
1. Run the helper script:
   ```bash
   python update_calendar_tokens.py
   ```
2. Enter the tokens when prompted
3. Restart the server

### Step 3: Verify Setup

Check the calendar status endpoint:
```
GET /schedule-agent/calendar/status
```

You should see:
```json
{
  "calendar_oauth_configured": true,
  "tokens_available": true,
  "status": "active",
  "message": "Calendar credentials are valid and working"
}
```

## Current Behavior

Until you complete the OAuth flow, the calendar endpoints will return **demo data** instead of real calendar data. This allows your app to continue working while you set up the proper authentication.

### Demo Mode Features

- **Events**: Returns sample calendar events
- **Free/Busy**: Returns sample busy times
- **Preferences**: Returns sample scheduling patterns
- **Suggestions**: Returns sample meeting time suggestions

All demo responses include a `demo_mode: true` flag and helpful messages about completing OAuth.

## Troubleshooting

### Common Issues

1. **"invalid_grant: Token has been expired or revoked"**
   - Solution: Complete the OAuth flow again to get fresh tokens

2. **"Calendar credentials not found"**
   - Solution: Ensure your `.env` file has the required tokens

3. **OAuth callback errors**
   - Check that your `BACKEND_URL` is correct in the `.env` file
   - Ensure the redirect URI is properly configured in Google Cloud Console

### Environment Variables Required

```env
GOOGLE_CALENDAR_CLIENT_ID=your_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
GOOGLE_CALENDAR_TOKEN=your_access_token
GOOGLE_CALENDAR_REFRESH_TOKEN=your_refresh_token
BACKEND_URL=your_backend_url
```

## API Endpoints

### Calendar Status
- `GET /schedule-agent/calendar/status` - Check token status

### Calendar Data (Demo Mode)
- `GET /schedule-agent/calendar/events` - Get calendar events
- `GET /schedule-agent/calendar/freebusy` - Get free/busy info
- `GET /schedule-agent/calendar/preferences` - Get scheduling preferences
- `GET /schedule-agent/calendar/suggest-time` - Suggest meeting times

### OAuth Flow
- `GET /schedule-agent/auth/google?user_id={user_id}` - Start OAuth
- `GET /schedule-agent/auth/google/callback` - OAuth callback

## Next Steps

After completing the OAuth flow and updating your tokens:

1. **Restart the server** to load the new tokens
2. **Test calendar features** to ensure they work with real data
3. **Monitor token expiration** - refresh tokens typically last longer but may still expire
4. **Consider implementing token storage** in a database for production use 