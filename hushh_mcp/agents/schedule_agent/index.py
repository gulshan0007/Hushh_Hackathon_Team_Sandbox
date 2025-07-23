"""
Schedule Agent - AI-powered calendar management
Part of the Hushh Modular Consent Protocol (MCP)
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

# Import configuration
import sys
sys.path.append('../../..')
from config import (
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_TOKEN,
    GOOGLE_CALENDAR_REFRESH_TOKEN,
    BACKEND_URL,
    AGENT_MASTER_KEY
)

class ScheduleAgent:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def get_calendar_credentials(self, user_id: str) -> Credentials:
        """Get Calendar credentials for a user."""
        try:
            # For demo/temp tokens, use the stored OAuth credentials from successful auth
            if user_id and (GOOGLE_CALENDAR_TOKEN and GOOGLE_CALENDAR_REFRESH_TOKEN):
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
                    creds.refresh(Request())
                    
                return creds
            else:
                self.logger.error("No calendar credentials available")
                return None
                
        except Exception as e:
            self.logger.error(f"Error getting Calendar credentials: {str(e)}")
            return None

    async def suggest_meeting_time(self, request: Request):
        """Suggest available meeting times."""
        try:
            data = await request.json()
            user_id = data.get('user_id')
            duration = data.get('duration', 60)  # minutes
            participants = data.get('participants', [])
            preferred_times = data.get('preferred_times', [])

            self.logger.info(f'🔍 Meeting time suggestion request: {data}')

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

            # Get busy times for all participants
            busy_times = []
            for participant in participants:
                freebusy_query = {
                    'timeMin': (datetime.now()).isoformat() + 'Z',
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

        except Exception as e:
            self.logger.error(f'❌ Error suggesting meeting times: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to suggest meeting times: {str(e)}"}
            )

    async def check_schedule_conflicts(self, request: Request):
        """Check for schedule conflicts."""
        try:
            data = await request.json()
            user_id = data.get('user_id')
            event_id = data.get('event_id')

            self.logger.info(f'🔍 Schedule conflict check request: {data}')

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

            # Get event details
            event = service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()

            # Get events around this time
            events_result = service.events().list(
                calendarId='primary',
                timeMin=event['start']['dateTime'],
                timeMax=event['end']['dateTime'],
                maxResults=10,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            conflicts = []
            for other_event in events_result.get('items', []):
                if other_event['id'] != event_id:
                    conflicts.append({
                        'id': other_event['id'],
                        'summary': other_event['summary'],
                        'start': other_event['start'].get('dateTime', other_event['start'].get('date')),
                        'end': other_event['end'].get('dateTime', other_event['end'].get('date'))
                    })

            return {"conflicts": conflicts}

        except Exception as e:
            self.logger.error(f'❌ Error checking schedule conflicts: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to check schedule conflicts: {str(e)}"}
            )

    async def optimize_schedule(self, request: Request):
        """Optimize schedule for better time management."""
        try:
            data = await request.json()
            user_id = data.get('user_id')
            timeframe = data.get('timeframe', '1w')

            self.logger.info(f'🔍 Schedule optimization request: {data}')

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

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

            # Analyze schedule patterns
            suggestions = []
            total_duration = timedelta()
            meeting_count = 0
            gaps = []

            for i in range(len(events) - 1):
                current = events[i]
                next_event = events[i + 1]

                current_end = datetime.fromisoformat(
                    current['end'].get('dateTime', current['end'].get('date'))
                )
                next_start = datetime.fromisoformat(
                    next_event['start'].get('dateTime', next_event['start'].get('date'))
                )

                gap = next_start - current_end
                if gap > timedelta(minutes=30):
                    gaps.append({
                        'start': current_end.isoformat(),
                        'end': next_start.isoformat(),
                        'duration': gap.total_seconds() / 60
                    })

                event_duration = current_end - datetime.fromisoformat(
                    current['start'].get('dateTime', current['start'].get('date'))
                )
                total_duration += event_duration
                meeting_count += 1

            # Generate optimization suggestions
            if meeting_count > 0:
                avg_duration = total_duration / meeting_count
                if avg_duration > timedelta(minutes=60):
                    suggestions.append({
                        'type': 'duration',
                        'message': 'Consider shortening meeting durations'
                    })

            if len(gaps) > 0:
                suggestions.append({
                    'type': 'gaps',
                    'message': 'Found scheduling gaps that could be utilized',
                    'gaps': gaps
                })

            return {
                "analysis": {
                    "total_meetings": meeting_count,
                    "average_duration": str(avg_duration) if meeting_count > 0 else "0",
                    "total_gaps": len(gaps)
                },
                "suggestions": suggestions
            }

        except Exception as e:
            self.logger.error(f'❌ Error optimizing schedule: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to optimize schedule: {str(e)}"}
            )

    async def handle_inbox_message(self, data: dict):
        """Handle incoming messages from inbox agent."""
        try:
            message_type = data.get('message_type')
            user_id = data.get('user_id')
            payload = data.get('payload', {})

            if message_type == 'email_to_event':
                # Handle email to event conversion
                email_id = payload.get('email_id')
                event_details = payload.get('event_details')
                # Your logic here
                return {"status": "success"}
            elif message_type == 'contact_sync':
                # Handle contact synchronization
                # Your logic here
                return {"status": "success"}
            else:
                return {"error": "Invalid message type"}

        except Exception as e:
            self.logger.error(f'❌ Error handling inbox message: {str(e)}')
            return {"error": str(e)}

    async def receive_message(self, data: dict):
        """Receive and process incoming messages."""
        try:
            message_type = data.get('message_type')
            user_id = data.get('user_id')
            payload = data.get('payload', {})

            if not all([message_type, user_id]):
                return {"error": "Missing required fields"}

            # Process message based on type
            if message_type == 'email_to_event':
                return await self.handle_email_to_event(user_id, payload)
            elif message_type == 'contact_sync':
                return await self.handle_contact_sync(user_id, payload)
            else:
                return {"error": "Invalid message type"}

        except Exception as e:
            self.logger.error(f'❌ Error receiving message: {str(e)}')
            return {"error": str(e)}

    async def handle_email_to_event(self, user_id: str, payload: dict):
        """Handle email to event conversion."""
        try:
            email_id = payload.get('email_id')
            event_details = payload.get('event_details')
            if not all([email_id, event_details]):
                return {"error": "Missing required fields"}

            # Your logic here
            return {"status": "success"}

        except Exception as e:
            self.logger.error(f'❌ Error handling email to event: {str(e)}')
            return {"error": str(e)}

    async def handle_contact_sync(self, user_id: str, payload: dict):
        """Handle contact synchronization."""
        try:
            contacts = payload.get('contacts')
            if not contacts:
                return {"error": "Missing contacts data"}

            # Your logic here
            return {"status": "success"}

        except Exception as e:
            self.logger.error(f'❌ Error handling contact sync: {str(e)}')
            return {"error": str(e)}

    async def get_freebusy(self, request: Request):
        """Get free/busy information for calendar."""
        try:
            token = request.query_params.get('token')
            user_id = request.query_params.get('user_id')
            time_min = request.query_params.get('time_min')
            time_max = request.query_params.get('time_max')

            self.logger.info(f'🔍 Free/busy request: {request.query_params}')

            # Simple token validation - allow temp tokens for demo
            if not token or not user_id:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Missing token or user_id"}
                )

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

            # Query free/busy
            body = {
                "timeMin": time_min or datetime.now().isoformat() + 'Z',
                "timeMax": time_max or (datetime.now() + timedelta(days=7)).isoformat() + 'Z',
                "items": [{"id": 'primary'}]
            }

            events_result = service.freebusy().query(body=body).execute()
            return events_result

        except Exception as e:
            self.logger.error(f'❌ Error getting free/busy info: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to get free/busy info: {str(e)}"}
            )

    async def get_events(self, request: Request):
        """Get calendar events."""
        try:
            token = request.query_params.get('token')
            user_id = request.query_params.get('user_id')
            time_min = request.query_params.get('time_min')
            time_max = request.query_params.get('time_max')

            self.logger.info(f'🔍 Events request: {request.query_params}')

            # Simple token validation - allow temp tokens for demo
            if not token or not user_id:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Missing token or user_id"}
                )

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

            # Get events
            events_result = service.events().list(
                calendarId='primary',
                timeMin=time_min or datetime.now().isoformat() + 'Z',
                timeMax=time_max or (datetime.now() + timedelta(days=7)).isoformat() + 'Z',
                maxResults=20,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            return events_result

        except Exception as e:
            self.logger.error(f'❌ Error getting events: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to get events: {str(e)}"}
            )

    async def get_preferences(self, request: Request):
        """Get user's scheduling preferences based on calendar patterns."""
        try:
            token = request.query_params.get('token')
            user_id = request.query_params.get('user_id')

            self.logger.info(f'🔍 Preferences request: {request.query_params}')

            # Get credentials
            creds = self.get_calendar_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Calendar credentials not found"}
                )

            # Get calendar service
            service = build('calendar', 'v3', credentials=creds)

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

        except Exception as e:
            self.logger.error(f'❌ Error getting preferences: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to get preferences: {str(e)}"}
            ) 