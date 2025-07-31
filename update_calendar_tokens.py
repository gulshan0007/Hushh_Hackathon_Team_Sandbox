#!/usr/bin/env python3
"""
Helper script to update Google Calendar tokens in .env file
Run this after completing the OAuth flow to update your tokens
"""

import os
import re
from pathlib import Path

def update_env_file(token, refresh_token):
    """Update the .env file with new calendar tokens"""
    env_path = Path('.env')
    
    if not env_path.exists():
        print("❌ .env file not found. Please create one first.")
        return False
    
    # Read current .env content
    with open(env_path, 'r') as f:
        content = f.read()
    
    # Update or add the tokens
    lines = content.split('\n')
    updated = False
    
    # Update existing tokens or add new ones
    for i, line in enumerate(lines):
        if line.startswith('GOOGLE_CALENDAR_TOKEN='):
            lines[i] = f'GOOGLE_CALENDAR_TOKEN={token}'
            updated = True
        elif line.startswith('GOOGLE_CALENDAR_REFRESH_TOKEN='):
            lines[i] = f'GOOGLE_CALENDAR_REFRESH_TOKEN={refresh_token}'
            updated = True
    
    # Add tokens if they don't exist
    if not any(line.startswith('GOOGLE_CALENDAR_TOKEN=') for line in lines):
        lines.append(f'GOOGLE_CALENDAR_TOKEN={token}')
    if not any(line.startswith('GOOGLE_CALENDAR_REFRESH_TOKEN=') for line in lines):
        lines.append(f'GOOGLE_CALENDAR_REFRESH_TOKEN={refresh_token}')
    
    # Write back to .env
    with open(env_path, 'w') as f:
        f.write('\n'.join(lines))
    
    print("✅ Successfully updated .env file with new calendar tokens")
    print("🔄 Please restart your server to use the new tokens")
    return True

def main():
    print("🔄 Google Calendar Token Updater")
    print("=" * 40)
    
    # Get tokens from user input
    print("Enter the tokens from your server logs:")
    token = input("GOOGLE_CALENDAR_TOKEN: ").strip()
    refresh_token = input("GOOGLE_CALENDAR_REFRESH_TOKEN: ").strip()
    
    if not token or not refresh_token:
        print("❌ Both tokens are required")
        return
    
    # Update the .env file
    if update_env_file(token, refresh_token):
        print("\n🎉 Tokens updated successfully!")
        print("📝 Next steps:")
        print("1. Restart your server")
        print("2. Test calendar features")
        print("3. Check /schedule-agent/calendar/status endpoint")
    else:
        print("❌ Failed to update tokens")

if __name__ == "__main__":
    main() 