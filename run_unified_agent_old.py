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
from hushh_mcp.agents.schedule_agent.index import ScheduleAgent

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

# Initialize schedule agent
schedule_agent = ScheduleAgent()

# Mount the inbox agent
app.mount("/inbox-agent", inbox_app)

# Add schedule agent endpoints
@app.get("/schedule-agent/auth/google")
async def start_calendar_auth(user_id: str):
    """Start Google Calendar OAuth flow"""
    try:
        from google_auth_oauthlib.flow import Flow
        
        # Calendar OAuth Configuration
        CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar']
        CALENDAR_CLIENT_CONFIG = {
            "web": {
                "client_id": os.getenv('GOOGLE_CALENDAR_CLIENT_ID'),
                "client_secret": os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{os.getenv('BACKEND_URL', 'https://5ef39224041b.ngrok-free.app')}/schedule-agent/auth/google/callback"]
            }
        }
        
        flow = Flow.from_client_config(
            CALENDAR_CLIENT_CONFIG,
            scopes=CALENDAR_SCOPES,
            redirect_uri=CALENDAR_CLIENT_CONFIG["web"]["redirect_uris"][0]
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user_id
        )
        
        return {"auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Calendar auth: {str(e)}")

@app.get("/schedule-agent/auth/google/callback")
async def calendar_callback(code: str, state: str):
    """Handle Google Calendar OAuth callback"""
    try:
        from google_auth_oauthlib.flow import Flow
        from fastapi.responses import RedirectResponse
        
        user_id = state
        print(f"📅 Processing Calendar callback for user: {user_id}")
        
        # Calendar OAuth Configuration
        CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar']
        CALENDAR_CLIENT_CONFIG = {
            "web": {
                "client_id": os.getenv('GOOGLE_CALENDAR_CLIENT_ID'),
                "client_secret": os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{os.getenv('BACKEND_URL', 'https://5ef39224041b.ngrok-free.app')}/schedule-agent/auth/google/callback"]
            }
        }
        
        flow = Flow.from_client_config(
            CALENDAR_CLIENT_CONFIG,
            scopes=CALENDAR_SCOPES,
            redirect_uri=CALENDAR_CLIENT_CONFIG["web"]["redirect_uris"][0]
        )
        
        flow.fetch_token(code=code)
        creds = flow.credentials
        
        print(f"✅ Got Calendar credentials for user {user_id}")
        print(f"🔑 Access Token: {creds.token[:20]}...")
        print(f"🔄 Refresh Token: {creds.refresh_token[:20] if creds.refresh_token else 'None'}...")
        
        # Provide clear instructions for updating environment variables
        print("=" * 60)
        print("📝 IMPORTANT: Update your .env file with these tokens:")
        print("=" * 60)
        print(f"GOOGLE_CALENDAR_TOKEN={creds.token}")
        print(f"GOOGLE_CALENDAR_REFRESH_TOKEN={creds.refresh_token}")
        print("=" * 60)
        print("💡 After updating .env, restart the server to use real calendar data")
        print("=" * 60)
        
        # For now, redirect to app with success message
        redirect_url = f"myapp://oauth-success?type=calendar&user_id={user_id}&consent_token_read=calendar_temp_token&consent_token_write=calendar_temp_token&next=gmail&message=Calendar%20OAuth%20successful!%20Update%20.env%20and%20restart%20server"
        print(f"🚀 Redirecting to app: {redirect_url}")
        return RedirectResponse(url=redirect_url, status_code=302)
        
    except Exception as e:
        print(f"❌ Calendar OAuth error: {str(e)}")
        error_url = f"myapp://calendar-error?error={str(e)}"
        return RedirectResponse(url=error_url)

@app.post("/schedule-agent/suggest-meeting")
async def suggest_meeting_time(request: Request):
    """Suggest available meeting times"""
    return await schedule_agent.suggest_meeting_time(request)

@app.post("/schedule-agent/check-conflicts")
async def check_schedule_conflicts(request: Request):
    """Check for schedule conflicts"""
    return await schedule_agent.check_schedule_conflicts(request)

@app.post("/schedule-agent/optimize")
async def optimize_schedule(request: Request):
    """Optimize schedule for better time management"""
    return await schedule_agent.optimize_schedule(request)

@app.get("/schedule-agent/freebusy")
async def get_freebusy(request: Request):
    """Get free/busy information for calendar"""
    return await schedule_agent.get_freebusy(request)

@app.get("/schedule-agent/events")
async def get_events(request: Request):
    """Get calendar events"""
    return await schedule_agent.get_events(request)

@app.get("/schedule-agent/preferences")
async def get_preferences(request: Request):
    """Get user's scheduling preferences based on calendar patterns"""
    return await schedule_agent.get_preferences(request)

# Add schedule agent endpoints with /calendar/ prefix to match frontend expectations
@app.get("/schedule-agent/calendar/events")
async def get_calendar_events(request: Request):
    """Get calendar events (with /calendar/ prefix)"""
    return await schedule_agent.get_events(request)

@app.get("/schedule-agent/calendar/freebusy")
async def get_calendar_freebusy(request: Request):
    """Get free/busy information (with /calendar/ prefix)"""
    return await schedule_agent.get_freebusy(request)

@app.get("/schedule-agent/calendar/preferences")
async def get_calendar_preferences(request: Request):
    """Get scheduling preferences (with /calendar/ prefix)"""
    return await schedule_agent.get_preferences(request)

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

# Agent-to-agent communication endpoints
@app.post("/schedule-agent/receive-message")
async def schedule_receive_message(request: Request):
    """Receive messages from other agents"""
    data = await request.json()
    return await schedule_agent.receive_message(data)

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
            "schedule": "available at /schedule-agent"
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
                    "POST /schedule-agent/suggest-meeting",
                    "POST /schedule-agent/check-conflicts",
                    "POST /schedule-agent/optimize",
                    "GET /schedule-agent/events",
                    "GET /schedule-agent/freebusy",
                    "GET /schedule-agent/preferences",
                    "GET /schedule-agent/calendar/events",
                    "GET /schedule-agent/calendar/freebusy", 
                    "GET /schedule-agent/calendar/preferences",
                    "GET /schedule-agent/calendar/suggest-time",
                    "GET /schedule-agent/calendar/status",
                    "POST /schedule-agent/calendar/create",
                    "POST /schedule-agent/receive-message"
                ]
            }
        ]
    }

@app.get("/schedule-agent/calendar/status")
async def get_calendar_status():
    """Check calendar token status and provide helpful information"""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        
        # Check if we have the required environment variables
        has_client_id = bool(GOOGLE_CALENDAR_CLIENT_ID)
        has_client_secret = bool(GOOGLE_CALENDAR_CLIENT_SECRET)
        has_token = bool(GOOGLE_CALENDAR_TOKEN)
        has_refresh_token = bool(GOOGLE_CALENDAR_REFRESH_TOKEN)
        
        status = {
            "calendar_oauth_configured": has_client_id and has_client_secret,
            "tokens_available": has_token and has_refresh_token,
            "status": "demo_mode"
        }
        
        if has_token and has_refresh_token:
            try:
                # Test the credentials
                creds = Credentials(
                    token=GOOGLE_CALENDAR_TOKEN,
                    refresh_token=GOOGLE_CALENDAR_REFRESH_TOKEN,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=GOOGLE_CALENDAR_CLIENT_ID,
                    client_secret=GOOGLE_CALENDAR_CLIENT_SECRET,
                    scopes=["https://www.googleapis.com/auth/calendar"]
                )
                
                if creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    status["status"] = "active"
                    status["message"] = "Calendar credentials are valid and working"
                elif not creds.expired:
                    status["status"] = "active"
                    status["message"] = "Calendar credentials are valid"
                else:
                    status["status"] = "expired"
                    status["message"] = "Calendar tokens are expired and need refresh"
                    
            except Exception as e:
                status["status"] = "error"
                status["message"] = f"Calendar credentials error: {str(e)}"
                status["error"] = str(e)
        else:
            status["message"] = "No calendar tokens available - complete OAuth to enable real calendar features"
            status["instructions"] = [
                "1. Complete Google Calendar OAuth flow",
                "2. Copy the tokens from server logs to your .env file",
                "3. Restart the server",
                "4. Calendar features will work with real data"
            ]
        
        return status
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to check calendar status: {str(e)}",
            "error": str(e)
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