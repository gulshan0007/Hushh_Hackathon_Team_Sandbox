"""
Inbox to Insight Agent - AI-powered email analysis and content generation
Part of the Hushh Modular Consent Protocol (MCP)
"""

import os
import json
import pickle
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import base64
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import openai

from ...consent.token import issue_token, validate_token
from ...vault.encrypt import encrypt_data, decrypt_data
from ...types import UserID, AgentID, EncryptedPayload
from ...constants import ConsentScope
from .manifest import AGENT_ID, SCOPES, DESCRIPTION
from .ai_features import EmailAIFeatures

# Import configuration
import sys
sys.path.append('../../..')
from config import (
    GOOGLE_CLIENT_ID as GMAIL_CLIENT_ID,
    GOOGLE_CLIENT_SECRET as GMAIL_CLIENT_SECRET,
    OPENAI_API_KEY,
    BACKEND_URL,
    AGENT_MASTER_KEY
)

# Configure OpenAI
openai.api_key = OPENAI_API_KEY

# Initialize AI features
ai_features = EmailAIFeatures(OPENAI_API_KEY)

app = FastAPI(title="Inbox to Insight Agent", description=DESCRIPTION)

# Gmail OAuth Configuration
GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose'
]

GMAIL_CLIENT_CONFIG = {
    "web": {
        "client_id": GMAIL_CLIENT_ID,
        "client_secret": GMAIL_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [f"{BACKEND_URL}/inbox-agent/auth/gmail/callback"]
    }
}

# Token storage
user_token_store: Dict[str, EncryptedPayload] = {}

def load_user_tokens():
    """Load encrypted user tokens from file"""
    try:
        with open('user_tokens_inbox.pkl', 'rb') as f:
            return pickle.load(f)
    except FileNotFoundError:
        return {}

def save_user_tokens(tokens: Dict[str, EncryptedPayload]):
    """Save encrypted user tokens to file"""
    with open('user_tokens_inbox.pkl', 'wb') as f:
        pickle.dump(tokens, f)

# Load tokens on startup
user_token_store = load_user_tokens()

def get_gmail_service(user_id: str):
    """Get authenticated Gmail service for user"""
    if user_id not in user_token_store:
        raise HTTPException(status_code=401, detail="No Gmail tokens for user")
    
    try:
        decrypted = decrypt_data(user_token_store[user_id], AGENT_MASTER_KEY)
        creds_data = json.loads(decrypted)
        
        # Debug: Check what we have in storage
        print(f"🔍 Stored credentials keys: {list(creds_data.keys())}")
        
        creds = Credentials.from_authorized_user_info(creds_data, GMAIL_SCOPES)
        
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
        
        return build('gmail', 'v1', credentials=creds)
    except Exception as e:
        print(f"❌ Gmail service error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to authenticate with Gmail: {str(e)}")

@app.get("/auth/gmail")
def start_gmail_auth(user_id: str = Query(...)):
    """Start Gmail OAuth flow"""
    try:
        flow = Flow.from_client_config(
            GMAIL_CLIENT_CONFIG,
            scopes=GMAIL_SCOPES,
            redirect_uri=GMAIL_CLIENT_CONFIG["web"]["redirect_uris"][0]
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',  # Force consent screen to get refresh token
            state=user_id
        )
        
        return {"auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Gmail auth: {str(e)}")

@app.get("/auth/gmail/callback")
def gmail_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Gmail OAuth callback"""
    try:
        user_id = state
        print(f"📧 Processing Gmail callback for user: {user_id}")
        print(f"🔑 Authorization code received: {code[:20]}...")
        
        flow = Flow.from_client_config(
            GMAIL_CLIENT_CONFIG,
            scopes=GMAIL_SCOPES,
            redirect_uri=GMAIL_CLIENT_CONFIG["web"]["redirect_uris"][0]
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
            scope=ConsentScope.GMAIL_READ,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours in milliseconds
        )
        write_token = issue_token(
            user_id=UserID(user_id),
            agent_id=AgentID(AGENT_ID),
            scope=ConsentScope.GMAIL_WRITE,
            expires_in_ms=24 * 60 * 60 * 1000  # 24 hours in milliseconds
        )
        print(f"✅ Tokens issued - Read: {read_token.token[:20]}..., Write: {write_token.token[:20]}...")
        
        # Redirect to app with tokens
        redirect_url = f"myapp://oauth-success?consent_token_read={read_token.token}&consent_token_write={write_token.token}&user_id={user_id}&type=gmail"
        print(f"🚀 Redirecting to app: {redirect_url}")
        return RedirectResponse(url=redirect_url, status_code=302)
    
    except Exception as e:
        print(f"❌ Gmail OAuth error: {str(e)}")
        error_url = f"myapp://gmail-error?error={str(e)}"
        return RedirectResponse(url=error_url)

@app.get("/test-connection")
def test_gmail_connection(
    token: str = Query(...),
    user_id: str = Query(...)
    ):
    """Quick test to check if Gmail connection works"""
    try:
        print(f"🧪 Testing Gmail connection for user {user_id[:8]}...")
        print(f"🔍 Token provided: {token[:20]}...")
        
        # Debug: Check if user exists in token store
        print(f"📊 Users in token store: {list(user_token_store.keys())}")
        print(f"🔍 Looking for user: {user_id}")
        
        is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
        print(f"🎫 Token validation - Valid: {is_valid}, Error: {error_msg}")
        
        if not is_valid:
            raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
        
        service = get_gmail_service(user_id)
        
        # Just get profile info - super fast
        profile = service.users().getProfile(userId='me').execute()
        
        return {
            "status": "connected",
            "email": profile.get('emailAddress', 'unknown'),
            "total_messages": profile.get('messagesTotal', 0),
            "message": "Gmail connection successful!"
        }
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gmail connection failed: {str(e)}")

@app.get("/emails")
def get_emails(
    token: str = Query(...),
    user_id: str = Query(...),
    max_results: int = Query(5, le=10),  # Even smaller default for testing
    page_token: str = Query(None)  # Use Gmail's pageToken for proper pagination
    ):
    """Fetch recent emails from Gmail with proper pagination"""
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        print(f"📧 Fetching emails for user {user_id[:8]}...")
        if page_token:
            print(f"📄 Using page token: {page_token[:20]}...")
        else:
            print(f"📄 Fetching first page...")
            
        service = get_gmail_service(user_id)
        
        # Use Gmail's built-in pagination with pageToken
        list_params = {
            'userId': 'me',
            'maxResults': max_results,
            'q': 'in:inbox'
        }
        
        if page_token:
            list_params['pageToken'] = page_token
        
        print(f"📋 Getting {max_results} messages...")
        results = service.users().messages().list(**list_params).execute()
        
        messages_for_page = results.get('messages', [])
        next_page_token = results.get('nextPageToken')
        
        print(f"📬 Found {len(messages_for_page)} messages")
        print(f"🔄 Next page token: {'Available' if next_page_token else 'None'}")
        
        # Get actual email details
        emails = []
        for i, msg in enumerate(messages_for_page):
            try:
                print(f"📩 Processing email {i+1}/{len(messages_for_page)}: {msg['id'][:8]}...")
                
                # Get full message details
                full_message = service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()
                
                # Extract headers
                headers = {h['name']: h['value'] for h in full_message['payload'].get('headers', [])}
                
                # Extract body content
                body_content = extract_email_body(full_message['payload'])
                
                emails.append({
                    'id': msg['id'],
                    'subject': headers.get('Subject', '(No subject)'),
                    'from': headers.get('From', 'Unknown sender'),
                    'date': headers.get('Date', 'Unknown date'),
                    'snippet': full_message.get('snippet', ''),
                    'body': body_content,  # Full email content
                    'hasAttachments': len(full_message['payload'].get('parts', [])) > 1
                })
                
            except Exception as e:
                print(f"❌ Error processing email {msg['id'][:8]}: {str(e)}")
                # Fallback to basic info
                emails.append({
                    'id': msg['id'],
                    'subject': f'Email #{i+1}',
                    'from': 'Gmail User',
                    'date': 'Recent',
                    'snippet': f'Email content from message {msg["id"][:8]}...',
                    'body': 'Content unavailable',
                    'hasAttachments': False
                })
        
        print(f"✅ Processed {len(emails)} emails with full content!")
        
        # Return emails with Gmail's pagination token
        return {
            "emails": emails,
            "pagination": {
                "has_more": bool(next_page_token),
                "next_page_token": next_page_token,
                "emails_on_page": len(emails),
                "max_results": max_results
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")

@app.post("/analyze")
async def analyze_emails(request: Request):
    """Analyze selected emails and generate insights"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    email_ids = data.get('email_ids', [])
    analysis_type = data.get('analysis_type', 'basic')
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        service = get_gmail_service(user_id)
        
        # Fetch email contents
        email_contents = []
        for email_id in email_ids[:10]:  # Limit to 10 emails for analysis
            try:
                message = service.users().messages().get(
                    userId='me',
                    id=email_id,
                    format='full'
                ).execute()
                
                headers = message['payload'].get('headers', [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                
                # Extract body text
                body = extract_email_body(message['payload'])
                
                email_contents.append({
                    'subject': subject,
                    'from': from_email,
                    'body': body[:1000]  # Limit body length
                })
                
            except Exception as e:
                print(f"Error fetching email {email_id}: {str(e)}")
                continue
        
        # Generate AI insights
        insights = generate_ai_insights(email_contents, analysis_type)
        
        return {"insights": insights}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze emails: {str(e)}")

@app.post("/generate")
async def generate_content(request: Request):
    """Generate smart replies and other AI content"""
    try:
        data = await request.json()
        
        # Extract required fields
        token = data.get('token')
        user_id = data.get('user_id')
        message_type = data.get('message_type')
        payload = data.get('payload')
        
        # Debug token
        print(f"🔍 Generate endpoint - Token debug:", {
            "token": token[:50] if token else None,
            "user_id": user_id,
            "message_type": message_type
        })
        
        # Validate token format
        if not token or ':' not in token:
            raise HTTPException(
                status_code=403, 
                detail="Invalid token format"
            )
        
        # Validate consent token
        is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
        if not is_valid:
            raise HTTPException(
                status_code=403, 
                detail=f"Consent validation failed: {error_msg}"
            )
        
        # Validate user ID matches token
        if parsed_token.user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="User ID mismatch"
            )
        
        # Handle different message types
        if message_type == 'smart_reply':
            email_id = payload.get('email_id')
            style = payload.get('style', 'professional')
            
            if not email_id:
                raise HTTPException(
                    status_code=400,
                    detail="Missing email_id in payload"
                )
            
            # Get email content
            try:
                service = get_gmail_service(user_id)
                message = service.users().messages().get(
                    userId='me',
                    id=email_id,
                    format='full'
                ).execute()
                
                headers = message['payload'].get('headers', [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                body = extract_email_body(message['payload'])
                
                email = {
                    'id': email_id,
                    'subject': subject,
                    'from': from_email,
                    'body': body
                }
                
                # Generate smart reply
                reply = ai_features.generate_smart_reply(email, style)
                return {"content": reply}
                
            except Exception as e:
                print(f"Error fetching email content: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to fetch email content: {str(e)}"
                )
            
        elif message_type == 'content_generation':
            # Handle content generation (summary, proposal, analysis, etc.)
            email_ids = payload.get('email_ids', [])
            content_type = payload.get('type', 'summary')
            custom_prompt = payload.get('custom_prompt', '')
            
            print(f"🔍 Content generation request: {content_type} for {len(email_ids)} emails")
            
            if not email_ids:
                raise HTTPException(
                    status_code=400,
                    detail="Missing email_ids in payload"
                )
            
            try:
                service = get_gmail_service(user_id)
                
                # Fetch email contents
                email_contents = []
                for email_id in email_ids[:10]:  # Limit to 10 emails for analysis
                    try:
                        message = service.users().messages().get(
                            userId='me',
                            id=email_id,
                            format='full'
                        ).execute()
                        
                        headers = message['payload'].get('headers', [])
                        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                        from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                        
                        # Extract body text
                        body = extract_email_body(message['payload'])
                        
                        email_contents.append({
                            'subject': subject,
                            'from': from_email,
                            'body': body[:1000]  # Limit body length
                        })
                        
                    except Exception as e:
                        print(f"Error fetching email {email_id}: {str(e)}")
                        continue
                
                # Generate content using AI
                if content_type in ['summary', 'proposal', 'analysis']:
                    content = generate_ai_content(email_contents, content_type, custom_prompt)
                else:
                    # Fallback to summary for unknown types
                    content = generate_ai_content(email_contents, 'summary', custom_prompt)
                
                return {"content": content}
                
            except Exception as e:
                print(f"Error generating content: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate content: {str(e)}"
                )
            
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported message type: {message_type}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating content: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate content: {str(e)}"
        )

@app.post("/categorize")
async def categorize_emails(request: Request):
    """Categorize emails into smart categories"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    email_ids = data.get('email_ids', [])
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        service = get_gmail_service(user_id)
        emails = []
        
        for email_id in email_ids:
            message = service.users().messages().get(
                userId='me',
                id=email_id,
                format='full'
            ).execute()
            
            headers = message['payload'].get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            body = extract_email_body(message['payload'])
            
            emails.append({
                'id': email_id,
                'subject': subject,
                'from': from_email,
                'body': body
            })
        
        categories = ai_features.categorize_emails(emails)
        return {"categories": categories}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to categorize emails: {str(e)}")

@app.post("/smart-reply")
async def generate_reply(request: Request):
    """Generate smart reply for an email"""
    data = await request.json()
    token = data.get('token')
    user_id = data.get('user_id')
    email_id = data.get('email_id')
    style = data.get('style', 'professional')
    
    # Validate consent token
    is_valid, error_msg, parsed_token = validate_token(token, ConsentScope.GMAIL_READ)
    if not is_valid:
        raise HTTPException(status_code=403, detail=f"Consent validation failed: {error_msg}")
    
    try:
        service = get_gmail_service(user_id)
        message = service.users().messages().get(
            userId='me',
            id=email_id,
            format='full'
        ).execute()
        
        headers = message['payload'].get('headers', [])
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
        from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
        body = extract_email_body(message['payload'])
        
        email = {
            'id': email_id,
            'subject': subject,
            'from': from_email,
            'body': body
        }
        
        reply = ai_features.generate_smart_reply(email, style)
        return {"reply": reply}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reply: {str(e)}")

class InboxAgent:
    def __init__(self, openai_api_key: Optional[str] = None):
        """Initialize InboxAgent with optional OpenAI API key."""
        self.ai_features = EmailAIFeatures(api_key=openai_api_key)
        self.logger = logging.getLogger(__name__)

    def get_gmail_credentials(self, user_id: str) -> Credentials:
        """Get Gmail credentials for a user."""
        try:
            # Load credentials from environment
            creds = Credentials(
                token=os.getenv('GOOGLE_GMAIL_TOKEN'),
                refresh_token=os.getenv('GOOGLE_GMAIL_REFRESH_TOKEN'),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.getenv('GOOGLE_CLIENT_ID'),
                client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
                scopes=[
                    'https://www.googleapis.com/auth/gmail.readonly',
                    'https://www.googleapis.com/auth/gmail.compose'
                ]
            )
            
            # Check if credentials are expired
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                
            return creds
        except Exception as e:
            self.logger.error(f"Error getting Gmail credentials: {str(e)}")
            return None

    async def extract_action_items(self, request: Request):
        """Extract action items from recent emails."""
        try:
            data = await request.json()
            user_id = data.get('user_id')
            email_count = data.get('email_count', 5)  # Default to last 5 emails
            has_token = data.get('has_token', False)

            self.logger.info(f'📋 Action items request: {data}')

            # Get credentials
            creds = self.get_gmail_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Gmail credentials not found"}
                )

            self.logger.info(f'🔍 Stored credentials keys: {list(creds.__dict__.keys())}')

            # Get recent emails
            service = build('gmail', 'v1', credentials=creds)
            results = service.users().messages().list(
                userId='me',
                maxResults=email_count,
                q='is:inbox'
            ).execute()

            messages = results.get('messages', [])
            if not messages:
                return {"action_items": []}

            # Process each email
            all_action_items = []
            for message in messages:
                msg = service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='full'
                ).execute()

                # Extract email content
                email_content = ""
                if 'payload' in msg and 'parts' in msg['payload']:
                    for part in msg['payload']['parts']:
                        if part.get('mimeType') == 'text/plain':
                            if 'data' in part['body']:
                                email_content += base64.urlsafe_b64decode(
                                    part['body']['data']
                                ).decode('utf-8')
                elif 'payload' in msg and 'body' in msg['payload']:
                    if 'data' in msg['payload']['body']:
                        email_content += base64.urlsafe_b64decode(
                            msg['payload']['body']['data']
                        ).decode('utf-8')

                # Get headers
                headers = msg['payload']['headers']
                subject = next(
                    (h['value'] for h in headers if h['name'].lower() == 'subject'),
                    'No Subject'
                )
                sender = next(
                    (h['value'] for h in headers if h['name'].lower() == 'from'),
                    'Unknown'
                )

                # Combine email metadata with content
                full_content = f"""
                Subject: {subject}
                From: {sender}
                
                {email_content}
                """

                # Extract action items
                action_items = self.ai_features.extract_action_items(full_content)
                
                # Add email context to each action item
                for item in action_items:
                    item['email_id'] = message['id']
                    item['email_subject'] = subject
                    item['email_from'] = sender

                all_action_items.extend(action_items)

            return {"action_items": all_action_items}

        except Exception as e:
            self.logger.error(f'❌ Error processing action items: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to process action items: {str(e)}"}
            )

    async def generate_content(self, request: Request):
        """Generate content based on email context."""
        try:
            data = await request.json()
            message_type = data.get('message_type')
            user_id = data.get('user_id')
            payload = data.get('payload', {})

            self.logger.info(f'🔍 Generate endpoint - Token debug: {data}')

            # Get credentials
            creds = self.get_gmail_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Gmail credentials not found"}
                )

            self.logger.info(f'🔍 Stored credentials keys: {list(creds.__dict__.keys())}')

            # Process based on message type
            if message_type == 'smart_reply':
                email_id = payload.get('email_id')
                style = payload.get('style', 'professional')
                content = await self.generate_smart_reply(email_id, style, creds)
                return {"content": content}
            else:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid message type"}
                )

        except Exception as e:
            self.logger.error(f'❌ Error generating content: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to generate content: {str(e)}"}
            )

    async def handle_schedule_message(self, data: dict):
        """Handle incoming messages from schedule agent."""
        try:
            message_type = data.get('message_type')
            user_id = data.get('user_id')
            payload = data.get('payload', {})

            if message_type == 'schedule_conflict':
                # Handle schedule conflict notification
                event_id = payload.get('event_id')
                # Your logic here
                return {"status": "success"}
            elif message_type == 'email_reminder':
                # Handle email reminder request
                event_id = payload.get('event_id')
                reminder_details = payload.get('reminder_details')
                # Your logic here
                return {"status": "success"}
            else:
                return {"error": "Invalid message type"}

        except Exception as e:
            self.logger.error(f'❌ Error handling schedule message: {str(e)}')
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
            if message_type == 'schedule_conflict':
                return await self.handle_schedule_conflict(user_id, payload)
            elif message_type == 'email_reminder':
                return await self.handle_email_reminder(user_id, payload)
            else:
                return {"error": "Invalid message type"}

        except Exception as e:
            self.logger.error(f'❌ Error receiving message: {str(e)}')
            return {"error": str(e)}

    async def handle_schedule_conflict(self, user_id: str, payload: dict):
        """Handle schedule conflict notifications."""
        try:
            event_id = payload.get('event_id')
            if not event_id:
                return {"error": "Missing event ID"}

            # Your logic here
            return {"status": "success"}

        except Exception as e:
            self.logger.error(f'❌ Error handling schedule conflict: {str(e)}')
            return {"error": str(e)}

    async def handle_email_reminder(self, user_id: str, payload: dict):
        """Handle email reminder requests."""
        try:
            event_id = payload.get('event_id')
            reminder_details = payload.get('reminder_details')
            if not all([event_id, reminder_details]):
                return {"error": "Missing required fields"}

            # Your logic here
            return {"status": "success"}

        except Exception as e:
            self.logger.error(f'❌ Error handling email reminder: {str(e)}')
            return {"error": str(e)}

    async def test_connection(self, request: Request):
        """Test Gmail connection."""
        try:
            token = request.query_params.get('token')
            user_id = request.query_params.get('user_id')

            self.logger.info(f'🔍 Test connection request: {request.query_params}')

            # Get credentials
            creds = self.get_gmail_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Gmail credentials not found"}
                )

            # Get Gmail service
            service = build('gmail', 'v1', credentials=creds)

            # Test connection by getting profile
            profile = service.users().getProfile(userId='me').execute()
            
            return {
                "status": "connected",
                "email": profile.get('emailAddress'),
                "messages_total": profile.get('messagesTotal', 0)
            }

        except Exception as e:
            self.logger.error(f'❌ Error testing connection: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to test connection: {str(e)}"}
            )

    async def get_emails(self, request: Request):
        """Get recent emails."""
        try:
            token = request.query_params.get('token')
            user_id = request.query_params.get('user_id')
            max_results = int(request.query_params.get('max_results', '5'))
            page_token = request.query_params.get('page_token')

            self.logger.info(f'🔍 Get emails request: {request.query_params}')

            # Get credentials
            creds = self.get_gmail_credentials(user_id)
            if not creds:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Gmail credentials not found"}
                )

            # Get Gmail service
            service = build('gmail', 'v1', credentials=creds)

            # Get messages
            results = service.users().messages().list(
                userId='me',
                maxResults=min(max_results, 10),  # Limit to 10 max
                pageToken=page_token,
                q='is:inbox'
            ).execute()

            messages = results.get('messages', [])
            next_page_token = results.get('nextPageToken')

            # Get full message details
            emails = []
            for message in messages:
                msg = service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='full'
                ).execute()

                # Extract headers
                headers = msg['payload']['headers']
                subject = next(
                    (h['value'] for h in headers if h['name'].lower() == 'subject'),
                    'No Subject'
                )
                sender = next(
                    (h['value'] for h in headers if h['name'].lower() == 'from'),
                    'Unknown'
                )
                date = next(
                    (h['value'] for h in headers if h['name'].lower() == 'date'),
                    ''
                )

                # Extract body
                body = self.extract_email_body(msg['payload'])

                emails.append({
                    'id': message['id'],
                    'thread_id': msg['threadId'],
                    'subject': subject,
                    'from': sender,
                    'date': date,
                    'snippet': msg.get('snippet', ''),
                    'body': body,
                    'labels': msg.get('labelIds', [])
                })

            return {
                "emails": emails,
                "next_page_token": next_page_token,
                "result_size_estimate": results.get('resultSizeEstimate', 0)
            }

        except Exception as e:
            self.logger.error(f'❌ Error getting emails: {str(e)}')
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to get emails: {str(e)}"}
            )

def extract_email_body(payload):
    """Extract plain text body from email payload"""
    body = ""
    
    if 'parts' in payload:
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                if 'data' in part['body']:
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
            elif part['mimeType'] == 'multipart/alternative' and 'parts' in part:
                for subpart in part['parts']:
                    if subpart['mimeType'] == 'text/plain' and 'data' in subpart['body']:
                        body = base64.urlsafe_b64decode(subpart['body']['data']).decode('utf-8')
                        break
    elif payload['mimeType'] == 'text/plain' and 'data' in payload['body']:
        body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
    
    return body

def generate_ai_insights(emails: List[Dict], analysis_type: str) -> Dict:
    """Generate AI insights from email data"""
    try:
        # Prepare email data for analysis
        email_text = "\n\n".join([
            f"Subject: {email['subject']}\nFrom: {email['from']}\nContent: {email['body'][:500]}"
            for email in emails
        ])
        
        prompt = f"""
        Analyze the following emails and provide comprehensive insights:
        
        {email_text}
        
        Please provide:
        1. A brief summary of the main themes and topics
        2. Key action items that need attention
        3. Important topics/keywords mentioned
        4. Overall priority level (high/medium/low)
        5. General sentiment (positive/neutral/negative)
        
        Format your response as JSON with these keys:
        - summary: string
        - actionItems: array of strings
        - keyTopics: array of strings  
        - priority: string (high/medium/low)
        - sentiment: string (positive/neutral/negative)
        """
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        
        # Parse JSON response
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        # Fallback insights if AI fails
        return {
            "summary": f"Analysis of {len(emails)} emails covering various topics and correspondence.",
            "actionItems": ["Review emails for important updates", "Respond to pending messages"],
            "keyTopics": ["Email", "Communication", "Updates"],
            "priority": "medium",
            "sentiment": "neutral"
        }

def generate_ai_content(emails: List[Dict], content_type: str, custom_prompt: str = "") -> str:
    """Generate AI content from email data"""
    try:
        # Prepare email data
        email_text = "\n\n".join([
            f"Subject: {email['subject']}\nFrom: {email['from']}\nContent: {email['body']}"
            for email in emails
        ])
        
        # Different prompts based on content type
        if content_type == 'summary':
            base_prompt = "Create a comprehensive summary of the following emails, highlighting key points, decisions made, and important information:"
        elif content_type == 'proposal':
            base_prompt = "Based on the following emails, create a professional proposal or response that addresses the main points and suggests next steps:"
        elif content_type == 'analysis':
            base_prompt = "Provide a detailed analysis of the following emails, including trends, patterns, relationships, and strategic insights:"
        else:
            base_prompt = "Process the following emails and provide a helpful response:"
        
        # Add custom prompt if provided
        if custom_prompt:
            base_prompt += f"\n\nAdditional instructions: {custom_prompt}"
        
        prompt = f"{base_prompt}\n\n{email_text}"
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        return f"Unable to generate {content_type} at this time. Please try again later."

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
    uvicorn.run(app, host="0.0.0.0", port=8000) 