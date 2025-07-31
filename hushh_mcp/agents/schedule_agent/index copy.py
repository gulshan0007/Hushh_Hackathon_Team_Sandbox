"""
Schedule Agent - AI-powered calendar management
Part of the Hushh Modular Consent Protocol (MCP)
"""

import os
import json
import pickle
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import base64

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from ...consent.token import issue_token, validate_token
from ...vault.encrypt import encrypt_data, decrypt_data
from ...types import UserID, AgentID, EncryptedPayload
from ...constants import ConsentScope
from .manifest import AGENT_ID, SCOPES, DESCRIPTION
from .ai_features import ScheduleAIFeatures

# Import configuration
import sys
sys.path.append('../../..')
from config import (
    GOOGLE_CLIENT_ID as CALENDAR_CLIENT_ID,
    GOOGLE_CLIENT_SECRET as CALENDAR_CLIENT_SECRET,
    BACKEND_URL,
    AGENT_MASTER_KEY,
    OPENAI_API_KEY
)

# Initialize AI features
ai_features = ScheduleAIFeatures(OPENAI_API_KEY)

app = FastAPI(title="Schedule Agent", description=DESCRIPTION)

# Google Calendar OAuth Configuration
CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

CALENDAR_CLIENT_CONFIG = {
    "web": {
        "client_id": CALENDAR_CLIENT_ID,
        "client_secret": CALENDAR_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [
            f"{BACKEND_URL}/schedule-agent/auth/google/callback"
        ]
    }
}

# Token storage
user_token_store: Dict[str, EncryptedPayload] = {}

def load_user_tokens():
    """Load encrypted user tokens from file"""
    try:
        with open('user_tokens_schedule.pkl', 'rb') as f:
            return pickle.load(f)
    except FileNotFoundError:
        return {}

def save_user_tokens(tokens: Dict[str, EncryptedPayload]):
    """Save encrypted user tokens to file"""
    with open('user_tokens_schedule.pkl', 'wb') as f:
        pickle.dump(tokens, f)

# Load tokens on startup
user_token_store = load_user_tokens()

def get_calendar_service(user_id: str):
    """Get authenticated Calendar service for user"""
    if user_id not in user_token_store:
        raise HTTPException(status_code=401, detail="No Calendar tokens for user")
    
    try:
        decrypted = decrypt_data(user_token_store[user_id], AGENT_MASTER_KEY)
        creds_data = json.loads(decrypted)
        
        # Debug: Check what we have in storage
        print(f"🔍 Stored credentials keys: {list(creds_data.keys())}")
        
        creds = Credentials.from_authorized_user_info(creds_data, CALENDAR_SCOPES)
        
        # Check if credentials are expired
        if creds.expired:
            if creds.refresh_token:
                print("🔄 Refreshing expired token...")
                creds.refresh(GoogleRequest())
                # Update stored credentials
                user_token_store[user_id] = encrypt_data(creds.to_json(), AGENT_MASTER_KEY)
                save_user_tokens(user_token_store)
                print("✅ Token refreshed successfully!")
            else:
                raise HTTPException(
                    status_code=401, 
                    detail="Token expired and no refresh token available. Please re-authorize."
                )
        
        return build('calendar', 'v3', credentials=creds)
    except Exception as e:
        print(f"❌ Calendar service error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to authenticate with Calendar: {str(e)}")

@app.get("/auth/google")
def start_calendar_auth(user_id: str = Query(...)):
    """Start Google Calendar OAuth flow"""
    try:
        print(f"🔍 Calendar OAuth endpoint called with user_id: {user_id}")
        print(f"🔍 Environment check:")
        print(f"  - CALENDAR_CLIENT_ID: {'SET' if CALENDAR_CLIENT_ID else 'NOT_SET'}")
        print(f"  - CALENDAR_CLIENT_SECRET: {'SET' if CALENDAR_CLIENT_SECRET else 'NOT_SET'}")
        print(f"  - BACKEND_URL: {BACKEND_URL}")
        
        # Use the exact redirect URI that matches Google Console
        redirect_uri = f"{BACKEND_URL}/schedule-agent/auth/google/callback"
        print(f"🔗 Using redirect URI: {redirect_uri}")
        
        flow = Flow.from_client_config(
            CALENDAR_CLIENT_CONFIG,
            scopes=CALENDAR_SCOPES,
            redirect_uri=redirect_uri
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',  # Force consent screen to get refresh token
            state=user_id
        )
        
        print(f"✅ Generated auth URL: {auth_url[:100]}...")
        return {"auth_url": auth_url}
    except Exception as e:
        print(f"❌ Calendar OAuth error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start Calendar auth: {str(e)}")

@app.get("/auth/google/callback")
def calendar_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Google Calendar OAuth callback"""
    try:
        user_id = state
        print(f"📅 Processing Calendar callback for user: {user_id}")
        print(f"🔑 Authorization code received: {code[:20]}...")
        
        # Use the exact same redirect URI as in the auth request
        redirect_uri = f"{BACKEND_URL}/schedule-agent/auth/google/callback"
        print(f"🔄 Using redirect URI: {redirect_uri}")
        
        flow = Flow.from_client_config(
            CALENDAR_CLIENT_CONFIG,
            scopes=CALENDAR_SCOPES,
            redirect_uri=redirect_uri
        )
        
        print("🔄 Exchanging code for tokens...")
        flow.fetch_token(code=code)
        creds = flow.credentials
        print("✅ Got Google credentials successfully!")
        
        # Debug: Check what credentials we got
        print(f"🔍 Credentials info - Has refresh token: {bool(creds.refresh_token)}")
        if not creds.refresh_token:
            print("⚠️ WARNING: No refresh token received! User may need to re-authorize.")
        
        # Encrypt and store credentials
        print("🔒 Encrypting and storing credentials...")
        encrypted = encrypt_data(creds.to_json(), AGENT_MASTER_KEY)
        user_token_store[user_id] = encrypted
        save_user_tokens(user_token_store)
        print("💾 Credentials saved to storage")
        
        # Issue consent tokens
        print("🎫 Issuing consent tokens...")
        read_token = issue_token(
            user_id=UserID(user_id),
            agent_id=AgentID(AGENT_ID),
            scope=ConsentScope.CALENDAR_READ,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours in milliseconds
        )
        write_token = issue_token(
            user_id=UserID(user_id),
            agent_id=AgentID(AGENT_ID),
            scope=ConsentScope.CALENDAR_WRITE,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours in milliseconds
        )
        print(f"✅ Tokens issued - Read: {read_token.token[:20]}..., Write: {write_token.token[:20]}...")
        
        # Redirect to app with tokens
        redirect_url = f"myapp://oauth-success?consent_token_read={read_token.token}&consent_token_write={write_token.token}&user_id={user_id}&type=calendar"
        print(f"🚀 Redirecting to app: {redirect_url}")
        return RedirectResponse(url=redirect_url, status_code=302)
                
    except Exception as e:
        print(f"❌ Calendar OAuth error: {str(e)}")
        error_url = f"myapp://calendar-error?error={str(e)}"
        return RedirectResponse(url=error_url)
@app.get("/test-connection")
def test_calendar_connection(
    token: str = Query(...),
    user_id: str = Query(...)
    ):
    """Quick test to check if Calendar connection works"""
    try:
        print(f"🧪 Testing Calendar connection for user {user_id[:8]}...")
        print(f"🔍 Token provided: {token[:20]}...")
        
        # Debug: Check if user exists in token store
        print(f"📊 Users in token store: {list(user_token_store.keys())}")
        print(f"🔍 Looking for user: {user_id}")
        
        is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
        print(f"🎫 Token validation - Valid: {is_valid}, Error: {error_msg}")
        
        if not is_valid:
            raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
        
        service = get_calendar_service(user_id)
        
        # Just get calendar list - super fast
        calendar_list = service.calendarList().list().execute()
        
        return {
            "status": "connected",
            "calendars": len(calendar_list.get('items', [])),
            "primary_calendar": next((cal['id'] for cal in calendar_list.get('items', []) if cal.get('primary')), 'primary'),
            "message": "Calendar connection successful!"
        }
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Calendar connection failed: {str(e)}")

@app.get("/events")
def get_events(
    token: str = Query(...),
    user_id: str = Query(...),
    max_results: int = Query(10, le=50),
    time_min: str = Query(None),
    time_max: str = Query(None)
    ):
    """Fetch calendar events with proper consent validation"""
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Fetching events for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Set default time range if not provided
        if not time_min:
            time_min = datetime.now().isoformat() + 'Z'
        if not time_max:
            time_max = (datetime.now() + timedelta(days=7)).isoformat() + 'Z'
        
        print(f"📅 Time range: {time_min} to {time_max}")
        
        # Get events
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        print(f"📅 Found {len(events)} events")
        
        # Process events
        processed_events = []
        for event in events:
            processed_events.append({
                'id': event['id'],
                'summary': event.get('summary', 'No Title'),
                'description': event.get('description', ''),
                'start': event['start'],
                'end': event['end'],
                'location': event.get('location', ''),
                'attendees': event.get('attendees', []),
                'organizer': event.get('organizer', {}),
                'status': event.get('status', 'confirmed'),
                'created': event.get('created', ''),
                'updated': event.get('updated', '')
            })
        
        return {
            "events": processed_events,
            "time_range": {
                "start": time_min,
                "end": time_max
            },
            "total_events": len(processed_events)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")

@app.post("/suggest-meeting-time")
async def suggest_meeting_time(request: Request):
    """Suggest available meeting times with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    duration = data.get('duration', 60)  # minutes
    participants = data.get('participants', [])
    preferred_times = data.get('preferred_times', [])
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Suggesting meeting times for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get busy times for all participants
        busy_times = []
        for participant in participants:
            freebusy_query = {
                'timeMin': datetime.now().isoformat() + 'Z',
                'timeMax': (datetime.now() + timedelta(days=7)).isoformat() + 'Z',
                'items': [{'id': participant}]
            }
            
            result = service.freebusy().query(body=freebusy_query).execute()
            for calendar in result['calendars'].values():
                busy_times.extend(calendar.get('busy', []))
        
        # Find available times
        available_times = []
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        end_time = current_time + timedelta(days=7)
        
        while current_time < end_time:
            slot_end = current_time + timedelta(minutes=duration)
            is_available = True
            
            # Check if slot conflicts with busy times
            for busy in busy_times:
                busy_start = datetime.fromisoformat(busy['start'].replace('Z', '+00:00'))
                busy_end = datetime.fromisoformat(busy['end'].replace('Z', '+00:00'))
                
                if (current_time < busy_end and slot_end > busy_start):
                    is_available = False
                    break
            
            # Check if slot is within preferred times
            if preferred_times:
                is_preferred = False
                for pref in preferred_times:
                    pref_start = datetime.fromisoformat(pref['start'])
                    pref_end = datetime.fromisoformat(pref['end'])
                    if current_time >= pref_start and slot_end <= pref_end:
                        is_preferred = True
                        break
                is_available = is_available and is_preferred
            
            if is_available:
                available_times.append({
                    'start': current_time.isoformat(),
                    'end': slot_end.isoformat()
                })
            
            current_time += timedelta(minutes=30)
        
        return {"available_times": available_times}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to suggest meeting times: {str(e)}")

@app.post("/create-event")
async def create_event(request: Request):
    """Create a new calendar event with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    event_data = data.get('event_data', {})
    
    # Validate consent token for write access
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_WRITE)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Creating event for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Create the event
        event = service.events().insert(
            calendarId='primary',
            body=event_data
        ).execute()
        
        return {
            "status": "success",
            "event_id": event['id'],
            "event_link": event.get('htmlLink', ''),
            "created": event.get('created', '')
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")

@app.post("/update-event")
async def update_event(request: Request):
    """Update an existing calendar event with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    event_id = data.get('event_id')
    event_data = data.get('event_data', {})
    
    # Validate consent token for write access
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_WRITE)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Updating event {event_id} for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Update the event
        event = service.events().update(
            calendarId='primary',
            eventId=event_id,
            body=event_data
        ).execute()
        
        return {
            "status": "success",
            "event_id": event['id'],
            "updated": event.get('updated', '')
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")

@app.delete("/delete-event")
async def delete_event(request: Request):
    """Delete a calendar event with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    event_id = data.get('event_id')
    
    # Validate consent token for write access
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_WRITE)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Deleting event {event_id} for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Delete the event
        service.events().delete(
            calendarId='primary',
            eventId=event_id
        ).execute()
        
        return {"status": "success", "message": "Event deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")

@app.get("/free-busy")
def get_free_busy(
    token: str = Query(...),
    user_id: str = Query(...),
    time_min: str = Query(None),
    time_max: str = Query(None),
    participants: str = Query(None)
    ):
    """Get free/busy information with consent validation"""
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Getting free/busy info for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Set default time range if not provided
        if not time_min:
            time_min = datetime.now().isoformat() + 'Z'
        if not time_max:
            time_max = (datetime.now() + timedelta(days=7)).isoformat() + 'Z'
        
        # Parse participants
        items = [{'id': 'primary'}]  # Always include primary calendar
        if participants:
            participant_list = participants.split(',')
            items.extend([{'id': p.strip()} for p in participant_list])
        
        # Query free/busy
        body = {
            "timeMin": time_min,
            "timeMax": time_max,
            "items": items
        }
        
        result = service.freebusy().query(body=body).execute()
        
        return {
            "free_busy": result,
            "time_range": {
                "start": time_min,
                "end": time_max
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get free/busy info: {str(e)}")

@app.get("/preferences")
def get_preferences(
    token: str = Query(...),
    user_id: str = Query(...)
    ):
    """Get user's scheduling preferences based on calendar patterns"""
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Getting preferences for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get events from last 30 days
        now = datetime.now()
        past = now - timedelta(days=30)
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=past.isoformat() + 'Z',
            timeMax=now.isoformat() + 'Z',
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Analyze patterns
        hour_counts = {}
        day_counts = {}
        duration_sum = 0
        duration_count = 0
        
        for event in events:
            if 'start' in event and 'dateTime' in event['start']:
                start_time = datetime.fromisoformat(event['start']['dateTime'].replace('Z', '+00:00'))
                hour = start_time.hour
                day = start_time.strftime('%A')
                
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
                day_counts[day] = day_counts.get(day, 0) + 1
                
                if 'end' in event and 'dateTime' in event['end']:
                    end_time = datetime.fromisoformat(event['end']['dateTime'].replace('Z', '+00:00'))
                    duration = (end_time - start_time).total_seconds() / 60  # minutes
                    duration_sum += duration
                    duration_count += 1
        
        # Find most common patterns
        most_common_hour = max(hour_counts, key=hour_counts.get) if hour_counts else 9
        most_common_day = max(day_counts, key=day_counts.get) if day_counts else 'Monday'
        avg_duration_minutes = int(duration_sum / duration_count) if duration_count > 0 else 60
        
        return {
            "most_common_hour": most_common_hour,
            "most_common_day": most_common_day,
            "avg_duration_minutes": avg_duration_minutes,
            "total_events": len(events),
            "hour_distribution": hour_counts,
            "day_distribution": day_counts
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@app.post("/optimize-schedule")
async def optimize_schedule(request: Request):
    """Optimize schedule using AI analysis with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    timeframe = data.get('timeframe', '1w')
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Optimizing schedule for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get events for the timeframe
        time_min = datetime.now()
        if timeframe == '1w':
            time_max = time_min + timedelta(days=7)
        elif timeframe == '2w':
            time_max = time_min + timedelta(days=14)
        else:
            time_max = time_min + timedelta(days=30)
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min.isoformat() + 'Z',
            timeMax=time_max.isoformat() + 'Z',
            maxResults=100,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Get user preferences
        preferences = await get_user_preferences_internal(user_id, service)
        
        # Use AI to optimize schedule
        optimization_result = ai_features.optimize_schedule(events, preferences)
        
        return {
            "optimization": optimization_result,
            "timeframe": timeframe,
            "total_events": len(events)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize schedule: {str(e)}")

@app.post("/ai-suggest-times")
async def ai_suggest_times(request: Request):
    """Get AI-powered meeting time suggestions with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    duration = data.get('duration', 60)
    participants = data.get('participants', [])
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Getting AI suggestions for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get busy times
        busy_times = []
        for participant in participants:
            freebusy_query = {
                'timeMin': datetime.now().isoformat() + 'Z',
                'timeMax': (datetime.now() + timedelta(days=7)).isoformat() + 'Z',
                'items': [{'id': participant}]
            }
            
            result = service.freebusy().query(body=freebusy_query).execute()
            for calendar in result['calendars'].values():
                busy_times.extend(calendar.get('busy', []))
        
        # Get user preferences
        preferences = await get_user_preferences_internal(user_id, service)
        
        # Use AI to suggest optimal times
        suggestions = ai_features.suggest_meeting_times(busy_times, duration, preferences)
        
        return {
            "suggestions": suggestions,
            "duration": duration,
            "participants": participants
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get AI suggestions: {str(e)}")

@app.post("/analyze-patterns")
async def analyze_patterns(request: Request):
    """Analyze scheduling patterns using AI with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    days_back = data.get('days_back', 30)
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Analyzing patterns for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get events from specified time period
        now = datetime.now()
        past = now - timedelta(days=days_back)
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=past.isoformat() + 'Z',
            timeMax=now.isoformat() + 'Z',
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Use AI to analyze patterns
        pattern_analysis = ai_features.analyze_patterns(events)
        
        return {
            "patterns": pattern_analysis,
            "analysis_period": f"Last {days_back} days",
            "total_events": len(events)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze patterns: {str(e)}")

@app.post("/detect-conflicts")
async def detect_conflicts(request: Request):
    """Detect scheduling conflicts using AI with consent validation"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    new_event = data.get('new_event', {})
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.CALENDAR_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📅 Detecting conflicts for user {user_id[:8]}...")
        
        service = get_calendar_service(user_id)
        
        # Get existing events around the new event time
        if 'start' in new_event and 'dateTime' in new_event['start']:
            start_time = datetime.fromisoformat(new_event['start']['dateTime'].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(new_event['end']['dateTime'].replace('Z', '+00:00'))
            
            # Get events in the same time range
            events_result = service.events().list(
                calendarId='primary',
                timeMin=start_time.isoformat() + 'Z',
                timeMax=end_time.isoformat() + 'Z',
                maxResults=50,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            existing_events = events_result.get('items', [])
            
            # Use AI to detect conflicts
            conflict_analysis = ai_features.detect_conflicts(new_event, existing_events)
            
            return {
                "conflicts": conflict_analysis,
                "new_event": new_event,
                "existing_events_count": len(existing_events)
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid event data")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect conflicts: {str(e)}")

async def get_user_preferences_internal(user_id: str, service) -> Dict:
    """Get user preferences for internal use"""
    try:
        # Get events from last 30 days
        now = datetime.now()
        past = now - timedelta(days=30)
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=past.isoformat() + 'Z',
            timeMax=now.isoformat() + 'Z',
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Analyze patterns
        hour_counts = {}
        day_counts = {}
        duration_sum = 0
        duration_count = 0
        
        for event in events:
            if 'start' in event and 'dateTime' in event['start']:
                start_time = datetime.fromisoformat(event['start']['dateTime'].replace('Z', '+00:00'))
                hour = start_time.hour
                day = start_time.strftime('%A')
                
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
                day_counts[day] = day_counts.get(day, 0) + 1
                
                if 'end' in event and 'dateTime' in event['end']:
                    end_time = datetime.fromisoformat(event['end']['dateTime'].replace('Z', '+00:00'))
                    duration = (end_time - start_time).total_seconds() / 60  # minutes
                    duration_sum += duration
                    duration_count += 1
        
        # Find most common patterns
        most_common_hour = max(hour_counts, key=hour_counts.get) if hour_counts else 9
        most_common_day = max(day_counts, key=day_counts.get) if day_counts else 'Monday'
        avg_duration_minutes = int(duration_sum / duration_count) if duration_count > 0 else 60
        
        return {
            "preferred_hours": f"{most_common_hour}-{most_common_hour+2}",
            "preferred_days": most_common_day,
            "avg_duration": avg_duration_minutes,
            "hour_distribution": hour_counts,
            "day_distribution": day_counts
        }
    
    except Exception as e:
        # Return default preferences if analysis fails
        return {
            "preferred_hours": "9-17",
            "preferred_days": "Monday-Friday",
            "avg_duration": 60,
            "hour_distribution": {},
            "day_distribution": {}
        }

# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent_id": AGENT_ID,
        "scopes": SCOPES,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 