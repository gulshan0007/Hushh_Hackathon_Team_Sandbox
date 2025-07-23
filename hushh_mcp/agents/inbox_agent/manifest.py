"""
Manifest for Inbox to Insight Agent
Defines agent metadata, scopes, and capabilities
"""

AGENT_ID = "inbox_agent"

from hushh_mcp.constants import ConsentScope

SCOPES = [
    ConsentScope.GMAIL_READ,      # Read emails and analyze content
    ConsentScope.GMAIL_WRITE,     # Generate and compose content
    "AI_ANALYZE",                 # Use AI for insights and analysis
    "DOCUMENT_PROCESS"           # Process documents and attachments
]

DESCRIPTION = """
🧠 Inbox to Insight Agent - AI-Powered Email Intelligence

Transform your Gmail inbox into actionable insights with consent-native AI analysis.

CORE CAPABILITIES:
• 📧 Gmail Integration - Secure OAuth2 connection to your Gmail account
• 🧠 AI Analysis - Advanced email content analysis and pattern recognition  
• 📊 Smart Insights - Generate summaries, action items, and priority assessments
• ✨ Content Generation - Create professional responses, proposals, and analyses
• 🔒 Privacy-First - All data encrypted, consent-validated operations
• 📱 Mobile-Optimized - Seamless experience across all devices

INTELLIGENT FEATURES:
• Automatic inbox summarization and key topic extraction
• Sentiment analysis and priority scoring
• Action item identification and deadline tracking
• Professional proposal and response generation
• Custom AI prompts for specific business needs
• Multi-email analysis for comprehensive insights

CONSENT & SECURITY:
• Explicit consent tokens for each operation (read/write)
• End-to-end encryption of all email data
• Scope-limited access (only requested permissions)
• Automatic token refresh and secure storage
• No data retention beyond active session

HACKATHON INNOVATION:
This agent represents the future of consent-native AI - where powerful 
intelligence meets absolute user control. Built with the Hushh Modular 
Consent Protocol (MCP), it demonstrates how AI can augment human 
productivity while respecting privacy and maintaining trust.

Perfect for professionals, entrepreneurs, and anyone who wants to turn 
their email chaos into organized, actionable intelligence.
"""

VERSION = "1.0.0"
AUTHOR = "Hushh Hackathon Team"
HACKATHON = "Hushh AI Personal Data Agent Challenge 2024"

FEATURES = [
    "Gmail OAuth2 Integration",
    "AI-Powered Email Analysis", 
    "Smart Content Generation",
    "Inbox Intelligence Dashboard",
    "Consent-Native Operations",
    "Privacy-Preserving Architecture",
    "Mobile-First Design",
    "Real-time Insights",
    "Custom AI Prompts",
    "Document Processing"
] 