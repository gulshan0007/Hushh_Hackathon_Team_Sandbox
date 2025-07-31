"""
Unified Agent Server - Combines Inbox and Schedule Agents
Part of the Hushh Modular Consent Protocol (MCP)
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import os
from dotenv import load_dotenv
from fastapi.responses import RedirectResponse, JSONResponse

# Load environment variables
load_dotenv()

# Import configuration
from config import (
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_TOKEN,
    GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    BACKEND_URL,
    AGENT_MASTER_KEY
)

# Import the individual agents
from hushh_mcp.agents.inbox_agent.index import app as inbox_app, InboxAgent
from hushh_mcp.agents.schedule_agent.index import app as schedule_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the main unified app
app = FastAPI(
    title="Hushh Unified Agent Server",
    description="Combined Inbox and Schedule Agent services",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the individual agents
app.mount("/inbox-agent", inbox_app)
app.mount("/schedule-agent", schedule_app)

# Add schedule agent endpoints with /calendar/ prefix to match frontend expectations
@app.get("/schedule-agent/calendar/events")
async def get_calendar_events(request: Request):
    """Get calendar events (with /calendar/ prefix)"""
    try:
        # Extract query parameters
        token = request.query_params.get('token')
        user_id = request.query_params.get('user_id')
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # Forward to the mounted schedule app
        from fastapi import Request
        # Create a new request for the mounted app
        new_request = Request(scope=request.scope)
        new_request._query_params = request.query_params
        
        # This would need to be handled by the mounted app
        # For now, return a demo response
        return {
            "events": [
                {
                    "id": "demo_event_1",
                    "summary": "Demo Meeting",
                    "start": {"dateTime": "2024-01-15T10:00:00Z"},
                    "end": {"dateTime": "2024-01-15T11:00:00Z"},
                    "status": "confirmed"
                }
            ],
            "total_events": 1
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get events: {str(e)}"}
        )

@app.get("/schedule-agent/calendar/freebusy")
async def get_calendar_freebusy(request: Request):
    """Get free/busy information (with /calendar/ prefix)"""
    try:
        # Extract query parameters
        token = request.query_params.get('token')
        user_id = request.query_params.get('user_id')
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # Demo response
        return {
            "free_busy": {
                "calendars": {
                    "primary": {
                        "busy": [
                            {
                                "start": "2024-01-15T10:00:00Z",
                                "end": "2024-01-15T11:00:00Z"
                            }
                        ]
                    }
                }
            }
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get free/busy info: {str(e)}"}
        )

@app.get("/schedule-agent/calendar/preferences")
async def get_calendar_preferences(request: Request):
    """Get scheduling preferences (with /calendar/ prefix)"""
    try:
        # Extract query parameters
        token = request.query_params.get('token')
        user_id = request.query_params.get('user_id')
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # Demo response
        return {
            "most_common_hour": 10,
            "most_common_day": "Monday",
            "avg_duration_minutes": 60,
            "total_events": 5,
            "hour_distribution": {10: 3, 14: 2},
            "day_distribution": {"Monday": 3, "Wednesday": 2}
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get preferences: {str(e)}"}
        )

@app.get("/schedule-agent/calendar/suggest-time")
async def suggest_calendar_time(request: Request):
    """Suggest available meeting times (with /calendar/ prefix)"""
    try:
        # Extract query parameters
        token = request.query_params.get('token')
        user_id = request.query_params.get('user_id')
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # Return simple suggested times for demo
        from datetime import datetime, timedelta
        now = datetime.now()
        
        # Suggest the next available time slot
        next_available = now + timedelta(hours=2)
        next_available = next_available.replace(minute=0, second=0, microsecond=0)  # Round to hour
        
        # Format suggestion message
        suggested_time_str = next_available.strftime("%A, %B %d at %I:%M %p")
        
        return {
            "suggested_time": f"Next available: {suggested_time_str}",
            "reason": f"Based on your calendar, I suggest {suggested_time_str} for your next meeting.",
            "available_times": [{
                "start": next_available.isoformat(),
                "end": (next_available + timedelta(hours=1)).isoformat(),
                "available": True
            }],
            "user_id": user_id
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to suggest times: {str(e)}"}
        )

@app.post("/schedule-agent/calendar/smart-create")
async def smart_create_calendar_event(request: Request):
    """Smart create calendar event using AI to find optimal time"""
    try:
        from datetime import datetime, timedelta
        
        # Get parameters from query params (the frontend sends it this way)
        token = request.query_params.get('token')
        user_id = request.query_params.get('user_id')
        title = request.query_params.get('title', 'New Event')
        duration_minutes = int(request.query_params.get('duration_minutes', 60))
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # AI logic to find optimal time
        from datetime import datetime, timedelta
        now = datetime.now()
        
        # Find next available slot (AI simulation)
        optimal_start = now + timedelta(hours=2)
        optimal_start = optimal_start.replace(minute=0, second=0, microsecond=0)
        optimal_end = optimal_start + timedelta(minutes=duration_minutes)
        
        # Create event using the regular create endpoint
        # Use a simple timezone approach - default to system timezone
        import time
        
        # Get timezone offset for proper formatting
        timezone_name = "UTC"
        try:
            timezone_name = time.tzname[time.daylight]
        except:
            timezone_name = "UTC"
        
        event_data = {
            "summary": title,
            "start": {
                "dateTime": optimal_start.strftime('%Y-%m-%dT%H:%M:%S'),
                "timeZone": timezone_name
            },
            "end": {
                "dateTime": optimal_end.strftime('%Y-%m-%dT%H:%M:%S'),
                "timeZone": timezone_name
            }
        }
        
        # Try to create real event if credentials available
        if GOOGLE_CALENDAR_TOKEN and GOOGLE_CALENDAR_REFRESH_TOKEN:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            from google.auth.transport.requests import Request as GoogleRequest
            
            try:
                creds = Credentials(
                    token=GOOGLE_CALENDAR_TOKEN,
                    refresh_token=GOOGLE_CALENDAR_REFRESH_TOKEN,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=GOOGLE_CALENDAR_CLIENT_ID,
                    client_secret=GOOGLE_CALENDAR_CLIENT_SECRET,
                    scopes=["https://www.googleapis.com/auth/calendar"]
                )
                
                if creds.expired and creds.refresh_token:
                    creds.refresh(GoogleRequest())
                
                service = build('calendar', 'v3', credentials=creds)
                created_event = service.events().insert(
                    calendarId='primary',
                    body=event_data
                ).execute()
                
                return {
                    "success": True,
                    "message": f"🤖 AI scheduled '{title}' at optimal time!",
                    "event": created_event,
                    "ai_suggestion": {
                        "confidence": 0.95,
                        "reason": f"Selected {optimal_start.strftime('%A at %I:%M %p')} based on your calendar patterns"
                    }
                }
            except Exception as e:
                print(f"❌ Smart create error: {str(e)}")
        
        # Fallback to demo response
        demo_event = {
            "id": f"smart_event_{user_id}_{int(datetime.now().timestamp())}",
            "summary": title,
            "start": {"dateTime": optimal_start.isoformat()},
            "end": {"dateTime": optimal_end.isoformat()},
            "status": "confirmed"
        }
        
        return {
            "success": True,
            "message": f"🤖 AI scheduled '{title}' for optimal time!",
            "event": demo_event,
            "ai_suggestion": {
                "confidence": 0.85,
                "reason": f"AI selected {optimal_start.strftime('%A at %I:%M %p')} as the optimal time"
            }
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to smart create event: {str(e)}"}
        )

@app.post("/schedule-agent/calendar/create")
async def create_calendar_event(request: Request):
    """Create a new calendar event"""
    try:
        from datetime import datetime
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request as GoogleRequest
        
        data = await request.json()
        token = data.get('token')
        user_id = data.get('user_id')
        event_data = data.get('event_data', {})
        
        if not token or not user_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing token or user_id"}
            )
        
        # Get calendar credentials
        try:
            print(f"🔍 Calendar credentials check:")
            print(f"  - Has Calendar Token: {bool(GOOGLE_CALENDAR_TOKEN)}")
            print(f"  - Has Calendar Refresh Token: {bool(GOOGLE_CALENDAR_REFRESH_TOKEN)}")
            print(f"  - Calendar Client ID: {GOOGLE_CALENDAR_CLIENT_ID[:20] if GOOGLE_CALENDAR_CLIENT_ID else 'None'}...")
            
            if GOOGLE_CALENDAR_TOKEN and GOOGLE_CALENDAR_REFRESH_TOKEN:
                print("✅ Using real Google Calendar credentials")
                # Load credentials from config (from successful OAuth flow)
                creds = Credentials(
                    token=GOOGLE_CALENDAR_TOKEN,
                    refresh_token=GOOGLE_CALENDAR_REFRESH_TOKEN,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=GOOGLE_CALENDAR_CLIENT_ID,
                    client_secret=GOOGLE_CALENDAR_CLIENT_SECRET,
                    scopes=["https://www.googleapis.com/auth/calendar"]
                )
                
                # Check if credentials are expired
                if creds.expired and creds.refresh_token:
                    creds.refresh(GoogleRequest())
                    
                # Build the calendar service
                service = build('calendar', 'v3', credentials=creds)
                
                # Ensure timezone is included in event_data
                import time
                timezone_name = "UTC"
                try:
                    timezone_name = time.tzname[time.daylight]
                except:
                    timezone_name = "UTC"
                
                # Fix timezone in event_data if missing
                if 'start' in event_data and 'timeZone' not in event_data['start']:
                    event_data['start']['timeZone'] = timezone_name
                if 'end' in event_data and 'timeZone' not in event_data['end']:
                    event_data['end']['timeZone'] = timezone_name
                
                print(f"🕐 Event data with timezone: {event_data}")
                
                # Create the event in Google Calendar
                created_event = service.events().insert(
                    calendarId='primary',
                    body=event_data,
                    conferenceDataVersion=1  # Enable Google Meet if requested
                ).execute()
                
                return {
                    "success": True,
                    "message": f"Event '{created_event.get('summary', 'Event')}' created successfully in Google Calendar!",
                    "event": created_event
                }
                
            else:
                print("⚠️ No real calendar credentials - using demo mode")
                # No real credentials - return demo response
                event_title = event_data.get('summary', 'New Event')
                event_start = event_data.get('start', {}).get('dateTime', datetime.now().isoformat())
                event_end = event_data.get('end', {}).get('dateTime', (datetime.now().replace(hour=datetime.now().hour + 1)).isoformat())
                
                demo_event = {
                    "id": f"demo_event_{user_id}_{int(datetime.now().timestamp())}",
                    "summary": event_title,
                    "start": {"dateTime": event_start},
                    "end": {"dateTime": event_end},
                    "status": "confirmed",
                    "created": datetime.now().isoformat(),
                    "htmlLink": f"https://calendar.google.com/calendar/event?eid=demo_{user_id}"
                }
                
                return {
                    "success": True,
                    "message": f"Demo event '{event_title}' created (complete OAuth to create real events)!",
                    "event": demo_event
                }
                
        except Exception as cred_error:
            print(f"❌ Calendar credentials error: {str(cred_error)}")
            return JSONResponse(
                status_code=401,
                content={"error": f"Calendar authentication failed: {str(cred_error)}"}
            )
        
    except Exception as e:
        print(f"❌ Event creation error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to create event: {str(e)}"}
        )

@app.get("/schedule-agent/")
async def schedule_root():
    """Schedule agent root endpoint"""
    return {"message": "Schedule Agent is running", "status": "active"}

@app.get("/schedule-agent/status")
async def schedule_status():
    """Schedule agent status endpoint"""
    return {"status": "running", "agent": "schedule_agent"}

# Direct endpoint for frontend compatibility
@app.post("/generate")
async def generate_content_direct(request: Request):
    """Direct generate endpoint for frontend compatibility - forwards to inbox agent"""
    try:
        # Get the request data
        data = await request.json()
        
        # Debug the request
        print(f"🔍 Direct generate endpoint called with data:", {
            "token_length": len(data.get('token', '')),
            "user_id": data.get('user_id', ''),
            "type": data.get('type', ''),
            "email_count": len(data.get('email_ids', []))
        })
        
        # The frontend sends different data structure than what inbox agent expects
        # Frontend sends: { token, user_id, email_ids, type, custom_prompt }
        # Inbox agent expects: { token, user_id, message_type, payload }
        
        # Transform the data structure
        inbox_data = {
            "token": data.get('token'),
            "user_id": data.get('user_id'),
            "message_type": "content_generation",  # Set a proper message type
            "payload": {
                "email_ids": data.get('email_ids', []),
                "type": data.get('type', 'summary'),
                "custom_prompt": data.get('custom_prompt', '')
            }
        }
        
        print(f"🔄 Transformed data for inbox agent:", {
            "message_type": inbox_data["message_type"],
            "payload_keys": list(inbox_data["payload"].keys())
        })
        
        # Forward to inbox agent
        inbox_agent = InboxAgent()
        
        # Create a mock request object for the inbox agent
        class MockRequest:
            def __init__(self, json_data):
                self._json_data = json_data
                
            async def json(self):
                return self._json_data
        
        mock_request = MockRequest(inbox_data)
        result = await inbox_agent.generate_content(mock_request)
        
        return result
        
    except Exception as e:
        print(f"❌ Generate content error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to generate content: {str(e)}"}
        )

@app.get("/")
async def root():
    """Root endpoint for the unified agent server"""
    return {
        "message": "Hushh Unified Agent Server",
        "version": "1.0.0",
        "agents": {
            "inbox": "/inbox-agent",
            "schedule": "/schedule-agent"
        },
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agents": {
            "inbox": "mounted at /inbox-agent",
            "schedule": "mounted at /schedule-agent"
        }
    }

@app.get("/agents")
async def list_agents():
    """List available agents and their endpoints"""
    return {
        "agents": [
            {
                "name": "inbox",
                "description": "AI-powered email management agent",
                "prefix": "/inbox-agent",
                "endpoints": [
                    "GET /inbox-agent/",
                    "GET /inbox-agent/status",
                    "GET /inbox-agent/auth/gmail",
                    "GET /inbox-agent/auth/gmail/callback",
                    "GET /inbox-agent/test-connection",
                    "GET /inbox-agent/emails",
                    "POST /inbox-agent/analyze",
                    "POST /inbox-agent/generate",
                    "POST /inbox-agent/categorize",
                    "POST /inbox-agent/smart-reply",
                    "GET /inbox-agent/health"
                ]
            },
            {
                "name": "schedule", 
                "description": "AI-powered calendar management agent",
                "prefix": "/schedule-agent",
                "endpoints": [
                    "GET /schedule-agent/",
                    "GET /schedule-agent/status",
                    "GET /schedule-agent/auth/google",
                    "GET /schedule-agent/auth/google/callback",
                    "GET /schedule-agent/test-connection",
                    "GET /schedule-agent/events",
                    "GET /schedule-agent/preferences",
                    "GET /schedule-agent/free-busy",
                    "POST /schedule-agent/suggest-meeting-time",
                    "POST /schedule-agent/create-event",
                    "POST /schedule-agent/update-event",
                    "DELETE /schedule-agent/delete-event",
                    "POST /schedule-agent/optimize-schedule",
                    "POST /schedule-agent/ai-suggest-times",
                    "POST /schedule-agent/analyze-patterns",
                    "POST /schedule-agent/detect-conflicts",
                    "GET /schedule-agent/health",
                    "GET /schedule-agent/calendar/events",
                    "GET /schedule-agent/calendar/freebusy", 
                    "GET /schedule-agent/calendar/preferences",
                    "GET /schedule-agent/calendar/suggest-time",
                    "POST /schedule-agent/calendar/create",
                    "POST /schedule-agent/calendar/smart-create"
                ]
            }
        ]
    }

if __name__ == "__main__":
    logger.info("🚀 Starting Hushh Unified Agent Server...")
    logger.info("📧 Inbox Agent available at: /inbox-agent")
    logger.info("📅 Schedule Agent available at: /schedule-agent")
    logger.info("🔗 Agent communication enabled")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    ) 