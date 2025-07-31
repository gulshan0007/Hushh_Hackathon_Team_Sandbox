#!/usr/bin/env python3
"""
Test script for free slots calculation
"""

from datetime import datetime, timedelta
import pytz

def test_free_slots_calculation():
    """Test the free slots calculation logic"""
    
    # Get IST timezone
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    print(f"Current time (IST): {now.strftime('%Y-%m-%d %I:%M %p')}")
    
    # Set business hours: 9 AM to 6 PM IST
    start_hour = 9
    end_hour = 18
    
    # Get today's date in IST
    today = now.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    end_time = today.replace(hour=end_hour, minute=0, second=0, microsecond=0)
    
    print(f"Business hours: {start_hour}:00 AM - {end_hour}:00 PM IST")
    print(f"Today: {today.strftime('%Y-%m-%d')}")
    
    # If it's past 6 PM, show slots for tomorrow
    if now.hour >= end_hour:
        today = today + timedelta(days=1)
        end_time = end_time + timedelta(days=1)
        print("Showing slots for tomorrow (past business hours)")
    
    # Generate all possible 1-hour slots from 9 AM to 6 PM
    available_slots = []
    current_slot = today
    
    while current_slot < end_time:
        slot_end = current_slot + timedelta(hours=1)
        
        # Check if this slot is in the future (for today)
        if current_slot > now or today.date() > now.date():
            available_slots.append({
                "start": current_slot.isoformat(),
                "end": slot_end.isoformat(),
                "available": True,
                "formatted_time": current_slot.strftime("%I:%M %p"),
                "duration_minutes": 60
            })
        
        current_slot = slot_end
    
    print(f"\nAll available slots ({len(available_slots)} total):")
    for i, slot in enumerate(available_slots, 1):
        print(f"{i}. {slot['formatted_time']} - {slot['duration_minutes']} min")
    
    # Demo: Assume meetings at 10 AM and 2 PM
    busy_hours = [10, 14]  # 10 AM and 2 PM
    filtered_slots = []
    
    for slot in available_slots:
        slot_start = datetime.fromisoformat(slot['start'].replace('Z', '+00:00'))
        hour = slot_start.hour
        
        if hour not in busy_hours:
            filtered_slots.append(slot)
    
    print(f"\nAfter filtering out busy times (meetings at 10 AM and 2 PM):")
    print(f"Free slots: {len(filtered_slots)}")
    print(f"Busy slots: {len(available_slots) - len(filtered_slots)}")
    
    for i, slot in enumerate(filtered_slots, 1):
        print(f"{i}. {slot['formatted_time']} - {slot['duration_minutes']} min")
    
    return {
        "total_slots": len(available_slots),
        "free_slots": len(filtered_slots),
        "busy_slots": len(available_slots) - len(filtered_slots),
        "business_hours": f"{start_hour}:00 AM - {end_hour}:00 PM IST"
    }

if __name__ == "__main__":
    result = test_free_slots_calculation()
    print(f"\nSummary:")
    print(f"Total slots: {result['total_slots']}")
    print(f"Free slots: {result['free_slots']}")
    print(f"Busy slots: {result['busy_slots']}")
    print(f"Business hours: {result['business_hours']}") 