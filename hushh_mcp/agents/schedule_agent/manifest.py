"""
Manifest for Schedule Agent
Defines agent metadata, scopes, and capabilities
"""

AGENT_ID = "schedule_agent"

from hushh_mcp.constants import ConsentScope

SCOPES = [
    ConsentScope.CALENDAR_READ,      # Read calendar events and availability
    ConsentScope.CALENDAR_WRITE,     # Create, update, and delete events
    "AI_SCHEDULE_OPTIMIZE",          # Use AI for scheduling optimization
    "PATTERN_LEARNING"               # Learn user scheduling patterns
]

DESCRIPTION = """
📅 Schedule Agent - AI-Powered Calendar Intelligence

Transform your calendar into an intelligent scheduling assistant with consent-native AI optimization.

CORE CAPABILITIES:
• 📅 Google Calendar Integration - Secure OAuth2 connection to your calendar
• 🧠 AI Scheduling - Advanced meeting time suggestions and conflict detection
• 📊 Pattern Learning - Learn your scheduling preferences and optimize accordingly
• ✨ Smart Optimization - Automatic schedule analysis and improvement suggestions
• 🔒 Privacy-First - All data encrypted, consent-validated operations
• 📱 Mobile-Optimized - Seamless experience across all devices

INTELLIGENT FEATURES:
• Automatic meeting time suggestions based on availability
• Conflict detection and resolution recommendations
• User preference learning (preferred hours, days, durations)
• Schedule optimization and gap analysis
• Free/busy information sharing with consent
• Event creation, updates, and deletion with proper validation

CONSENT & SECURITY:
• Explicit consent tokens for each operation (read/write)
• End-to-end encryption of all calendar data
• Scope-limited access (only requested permissions)
• Automatic token refresh and secure storage
• No data retention beyond active session

HACKATHON INNOVATION:
This agent represents the future of consent-native scheduling - where intelligent 
calendar management meets absolute user control. Built with the Hushh Modular 
Consent Protocol (MCP), it demonstrates how AI can optimize time management 
while respecting privacy and maintaining trust.

Perfect for professionals, teams, and anyone who wants to transform their 
calendar from a simple tool into an intelligent scheduling assistant.
"""

VERSION = "1.0.0"
AUTHOR = "Hushh Hackathon Team"
HACKATHON = "Hushh AI Personal Data Agent Challenge 2024"

FEATURES = [
    "Google Calendar OAuth2 Integration",
    "AI-Powered Meeting Time Suggestions", 
    "Smart Conflict Detection",
    "User Preference Learning",
    "Schedule Optimization Analytics",
    "Consent-Native Operations",
    "Privacy-Preserving Architecture",
    "Mobile-First Design",
    "Real-time Calendar Synchronization",
    "Encrypted Credential Storage"
] 