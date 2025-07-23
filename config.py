"""
Configuration file for Hushh MCP
Loads environment variables for the agents
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Calendar Agent - Google Cloud Project 1
GOOGLE_CALENDAR_CLIENT_ID = os.getenv('GOOGLE_CALENDAR_CLIENT_ID', '')
GOOGLE_CALENDAR_CLIENT_SECRET = os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET', '')
GOOGLE_CALENDAR_TOKEN = os.getenv('GOOGLE_CALENDAR_TOKEN', '')
GOOGLE_CALENDAR_REFRESH_TOKEN = os.getenv('GOOGLE_CALENDAR_REFRESH_TOKEN', '')

# Gmail Agent - Google Cloud Project 2
GOOGLE_GMAIL_CLIENT_ID = os.getenv('GOOGLE_GMAIL_CLIENT_ID', '')
GOOGLE_GMAIL_CLIENT_SECRET = os.getenv('GOOGLE_GMAIL_CLIENT_SECRET', '')

# Backward compatibility - if separate Gmail credentials not provided, use calendar ones
GOOGLE_CLIENT_ID = GOOGLE_GMAIL_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CLIENT_SECRET = GOOGLE_GMAIL_CLIENT_SECRET or GOOGLE_CALENDAR_CLIENT_SECRET

# Gmail specific tokens (mapped for compatibility)
GMAIL_CLIENT_ID = GOOGLE_GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET = GOOGLE_GMAIL_CLIENT_SECRET

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

# Backend URL
BACKEND_URL = os.getenv('BACKEND_URL', 'https://6064e54e2e4d.ngrok-free.app')

# Agent Master Key for encryption
AGENT_MASTER_KEY = os.getenv('AGENT_MASTER_KEY', 'default-key-change-in-production')

# Debug flag
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true' 