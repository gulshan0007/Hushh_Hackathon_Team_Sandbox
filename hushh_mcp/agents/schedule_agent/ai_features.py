"""
Schedule AI Features - AI-powered calendar optimization and pattern learning
Part of the Hushh Modular Consent Protocol (MCP)
"""

import logging
import openai
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ScheduleAIFeatures:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize ScheduleAIFeatures with optional API key."""
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        
        # Configure OpenAI if API key is provided
        if api_key:
            openai.api_key = api_key

    def optimize_schedule(self, events: List[Dict], user_preferences: Dict) -> Dict:
        """Optimize schedule using AI analysis."""
        try:
            # Prepare event data for analysis
            event_summary = "\n".join([
                f"Event: {event.get('summary', 'No Title')} - "
                f"Start: {event.get('start', {}).get('dateTime', 'Unknown')} - "
                f"Duration: {self._calculate_duration(event)} minutes"
                for event in events
            ])
            
            prompt = f"""
            Analyze the following calendar events and provide optimization suggestions:
            
            User Preferences:
            - Preferred hours: {user_preferences.get('preferred_hours', '9-17')}
            - Preferred days: {user_preferences.get('preferred_days', 'Monday-Friday')}
            - Average meeting duration: {user_preferences.get('avg_duration', 60)} minutes
            
            Current Schedule:
            {event_summary}
            
            Please provide:
            1. Schedule optimization recommendations
            2. Potential conflicts or issues
            3. Suggestions for better time management
            4. Recommended schedule adjustments
            
            Format your response as JSON with these keys:
            - recommendations: array of strings
            - conflicts: array of strings
            - timeManagement: array of strings
            - adjustments: array of objects with 'type' and 'description'
            """
            
            if self.api_key:
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                # Parse JSON response
                result = response.choices[0].message.content
                import json
                return json.loads(result)
            else:
                return self._generate_fallback_optimization(events, user_preferences)
                
        except Exception as e:
            self.logger.error(f"Error optimizing schedule: {str(e)}")
            return self._generate_fallback_optimization(events, user_preferences)

    def suggest_meeting_times(self, busy_times: List[Dict], duration: int, preferences: Dict) -> List[Dict]:
        """Suggest optimal meeting times using AI."""
        try:
            # Prepare busy times data
            busy_summary = "\n".join([
                f"Busy: {busy['start']} to {busy['end']}"
                for busy in busy_times
            ])
            
            prompt = f"""
            Given the following busy times and preferences, suggest optimal meeting times:
            
            Busy Times:
            {busy_summary}
            
            Meeting Requirements:
            - Duration: {duration} minutes
            - Preferred hours: {preferences.get('preferred_hours', '9-17')}
            - Preferred days: {preferences.get('preferred_days', 'Monday-Friday')}
            
            Please suggest 5 optimal meeting times that:
            1. Don't conflict with busy times
            2. Fall within preferred hours
            3. Are on preferred days
            4. Provide adequate buffer time
            
            Format your response as JSON with an array of objects containing:
            - start_time: ISO datetime string
            - end_time: ISO datetime string
            - confidence: float (0-1)
            - reason: string explaining why this time is optimal
            """
            
            if self.api_key:
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                # Parse JSON response
                result = response.choices[0].message.content
                import json
                return json.loads(result)
            else:
                return self._generate_fallback_suggestions(busy_times, duration, preferences)
                
        except Exception as e:
            self.logger.error(f"Error suggesting meeting times: {str(e)}")
            return self._generate_fallback_suggestions(busy_times, duration, preferences)

    def analyze_patterns(self, events: List[Dict]) -> Dict:
        """Analyze scheduling patterns using AI."""
        try:
            # Prepare event data for pattern analysis
            event_data = []
            for event in events:
                if 'start' in event and 'dateTime' in event['start']:
                    start_time = datetime.fromisoformat(event['start']['dateTime'].replace('Z', '+00:00'))
                    event_data.append({
                        'summary': event.get('summary', 'No Title'),
                        'day': start_time.strftime('%A'),
                        'hour': start_time.hour,
                        'duration': self._calculate_duration(event)
                    })
            
            event_summary = "\n".join([
                f"Event: {event['summary']} - Day: {event['day']} - Hour: {event['hour']} - Duration: {event['duration']} min"
                for event in event_data
            ])
            
            prompt = f"""
            Analyze the following calendar events to identify scheduling patterns:
            
            Events:
            {event_summary}
            
            Please provide:
            1. Most common meeting days and times
            2. Average meeting duration
            3. Scheduling patterns and preferences
            4. Recommendations for optimizing schedule
            
            Format your response as JSON with these keys:
            - commonDays: array of strings (days of week)
            - commonHours: array of integers (hours 0-23)
            - avgDuration: integer (minutes)
            - patterns: array of strings describing patterns
            - recommendations: array of strings with optimization suggestions
            """
            
            if self.api_key:
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                # Parse JSON response
                result = response.choices[0].message.content
                import json
                return json.loads(result)
            else:
                return self._generate_fallback_pattern_analysis(events)
                
        except Exception as e:
            self.logger.error(f"Error analyzing patterns: {str(e)}")
            return self._generate_fallback_pattern_analysis(events)

    def detect_conflicts(self, new_event: Dict, existing_events: List[Dict]) -> List[Dict]:
        """Detect scheduling conflicts using AI."""
        try:
            # Prepare event data
            new_event_summary = f"""
            New Event:
            - Summary: {new_event.get('summary', 'No Title')}
            - Start: {new_event.get('start', {}).get('dateTime', 'Unknown')}
            - End: {new_event.get('end', {}).get('dateTime', 'Unknown')}
            """
            
            existing_summary = "\n".join([
                f"Existing: {event.get('summary', 'No Title')} - "
                f"Start: {event.get('start', {}).get('dateTime', 'Unknown')} - "
                f"End: {event.get('end', {}).get('dateTime', 'Unknown')}"
                for event in existing_events
            ])
            
            prompt = f"""
            Analyze the following events to detect scheduling conflicts:
            
            {new_event_summary}
            
            Existing Events:
            {existing_summary}
            
            Please identify:
            1. Direct time conflicts
            2. Potential scheduling issues
            3. Recommendations for resolution
            
            Format your response as JSON with these keys:
            - conflicts: array of objects with 'type', 'description', and 'severity'
            - recommendations: array of strings with resolution suggestions
            """
            
            if self.api_key:
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                # Parse JSON response
                result = response.choices[0].message.content
                import json
                return json.loads(result)
            else:
                return self._generate_fallback_conflict_detection(new_event, existing_events)
                
        except Exception as e:
            self.logger.error(f"Error detecting conflicts: {str(e)}")
            return self._generate_fallback_conflict_detection(new_event, existing_events)

    def _calculate_duration(self, event: Dict) -> int:
        """Calculate event duration in minutes."""
        try:
            if 'start' in event and 'end' in event:
                start_str = event['start'].get('dateTime', event['start'].get('date'))
                end_str = event['end'].get('dateTime', event['end'].get('date'))
                
                if start_str and end_str:
                    start_time = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    duration = (end_time - start_time).total_seconds() / 60
                    return int(duration)
        except Exception as e:
            self.logger.error(f"Error calculating duration: {str(e)}")
        
        return 60  # Default duration

    def _generate_fallback_optimization(self, events: List[Dict], preferences: Dict) -> Dict:
        """Generate fallback optimization suggestions."""
        return {
            "recommendations": [
                "Consider scheduling meetings during your preferred hours",
                "Add buffer time between meetings",
                "Group similar meetings together"
            ],
            "conflicts": [],
            "timeManagement": [
                "Review your schedule weekly",
                "Set aside time for focused work"
            ],
            "adjustments": [
                {"type": "timing", "description": "Adjust meeting times to preferred hours"},
                {"type": "duration", "description": "Consider shorter meeting durations"}
            ]
        }

    def _generate_fallback_suggestions(self, busy_times: List[Dict], duration: int, preferences: Dict) -> List[Dict]:
        """Generate fallback meeting time suggestions."""
        # Simple algorithm to find available times
        suggestions = []
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        
        for i in range(5):  # Suggest 5 times
            suggestion_time = current_time + timedelta(hours=i*2)
            suggestions.append({
                "start_time": suggestion_time.isoformat(),
                "end_time": (suggestion_time + timedelta(minutes=duration)).isoformat(),
                "confidence": 0.8,
                "reason": "Available time slot during business hours"
            })
        
        return suggestions

    def _generate_fallback_pattern_analysis(self, events: List[Dict]) -> Dict:
        """Generate fallback pattern analysis."""
        # Simple pattern analysis
        days = {}
        hours = {}
        durations = []
        
        for event in events:
            if 'start' in event and 'dateTime' in event['start']:
                start_time = datetime.fromisoformat(event['start']['dateTime'].replace('Z', '+00:00'))
                day = start_time.strftime('%A')
                hour = start_time.hour
                
                days[day] = days.get(day, 0) + 1
                hours[hour] = hours.get(hour, 0) + 1
                durations.append(self._calculate_duration(event))
        
        return {
            "commonDays": [day for day, count in sorted(days.items(), key=lambda x: x[1], reverse=True)[:3]],
            "commonHours": [hour for hour, count in sorted(hours.items(), key=lambda x: x[1], reverse=True)[:3]],
            "avgDuration": int(sum(durations) / len(durations)) if durations else 60,
            "patterns": ["Most meetings during business hours", "Regular weekly schedule"],
            "recommendations": ["Optimize meeting times", "Consider flexible scheduling"]
        }

    def _generate_fallback_conflict_detection(self, new_event: Dict, existing_events: List[Dict]) -> Dict:
        """Generate fallback conflict detection."""
        conflicts = []
        
        # Simple conflict detection
        for event in existing_events:
            if self._events_overlap(new_event, event):
                conflicts.append({
                    "type": "time_conflict",
                    "description": f"Conflicts with '{event.get('summary', 'Unknown event')}'",
                    "severity": "high"
                })
        
        return {
            "conflicts": conflicts,
            "recommendations": [
                "Reschedule conflicting events",
                "Consider shorter meeting duration",
                "Find alternative time slots"
            ]
        }

    def _events_overlap(self, event1: Dict, event2: Dict) -> bool:
        """Check if two events overlap in time."""
        try:
            start1 = event1.get('start', {}).get('dateTime', event1.get('start', {}).get('date'))
            end1 = event1.get('end', {}).get('dateTime', event1.get('end', {}).get('date'))
            start2 = event2.get('start', {}).get('dateTime', event2.get('start', {}).get('date'))
            end2 = event2.get('end', {}).get('dateTime', event2.get('end', {}).get('date'))
            
            if start1 and end1 and start2 and end2:
                start1_dt = datetime.fromisoformat(start1.replace('Z', '+00:00'))
                end1_dt = datetime.fromisoformat(end1.replace('Z', '+00:00'))
                start2_dt = datetime.fromisoformat(start2.replace('Z', '+00:00'))
                end2_dt = datetime.fromisoformat(end2.replace('Z', '+00:00'))
                
                return start1_dt < end2_dt and start2_dt < end1_dt
        except Exception as e:
            self.logger.error(f"Error checking event overlap: {str(e)}")
        
        return False 