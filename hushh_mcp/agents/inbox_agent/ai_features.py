"""
Email AI Features - AI-powered email analysis and content generation
Part of the Hushh Modular Consent Protocol (MCP)
"""

import logging
import openai
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class EmailAIFeatures:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize EmailAIFeatures with optional API key."""
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        
        # Configure OpenAI if API key is provided
        if api_key:
            openai.api_key = api_key

    def generate_smart_reply(self, email: Dict, style: str = 'professional') -> str:
        """Generate a smart reply for an email using ChatGPT."""
        try:
            # Extract email details
            subject = email.get('subject', 'No Subject')
            sender = email.get('from', 'Unknown')
            body = email.get('body', '')
            
            # Create a comprehensive prompt for ChatGPT
            style_instructions = {
                'professional': 'Write a professional, courteous, and business-appropriate response.',
                'casual': 'Write a friendly, casual, and conversational response.',
                'formal': 'Write a formal, respectful, and official response.',
                'brief': 'Write a brief, concise, and to-the-point response.',
                'detailed': 'Write a detailed, comprehensive, and thorough response.'
            }
            
            style_instruction = style_instructions.get(style, style_instructions['professional'])
            
            prompt = f"""
You are an AI assistant helping to compose email replies. Please read the following email carefully and generate a thoughtful, appropriate response.

Original Email:
Subject: {subject}
From: {sender}
Content: {body}

Instructions:
- {style_instruction}
- Address the main points and questions in the original email
- Be helpful and constructive
- Match the tone appropriately
- Do not include email headers (To:, From:, Subject:) in your response
- Generate only the body content of the reply
- Make the response complete and comprehensive - do not truncate or summarize

Please generate the complete reply:
"""

            # Use OpenAI to generate the reply with maximum token allowance
            if self.api_key:
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system", 
                            "content": "You are a helpful email assistant. Generate complete, thoughtful email replies based on the content provided. Always provide the full response without truncation."
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    max_tokens=2000,  # Increased token limit for complete responses
                    temperature=0.7,  # Balanced creativity
                    top_p=1.0,
                    frequency_penalty=0.0,
                    presence_penalty=0.0
                )
                
                # Extract the complete response
                reply_content = response.choices[0].message.content.strip()
                
                # Log the generated reply for debugging
                self.logger.info(f"Generated smart reply for email '{subject[:50]}...' - Length: {len(reply_content)} characters")
                
                return reply_content
            else:
                # Fallback if no API key
                self.logger.warning("No OpenAI API key provided, using fallback reply")
                return self._generate_fallback_reply(email, style)
                
        except Exception as e:
            self.logger.error(f"Error generating smart reply: {str(e)}")
            # Return a more informative fallback
            return self._generate_fallback_reply(email, style)

    def _generate_fallback_reply(self, email: Dict, style: str) -> str:
        """Generate a fallback reply when OpenAI is not available."""
        subject = email.get('subject', 'No Subject')
        sender = email.get('from', 'Unknown')
        
        if style == 'professional':
            return f"Dear {sender.split('<')[0].strip() if '<' in sender else 'Sender'},\n\nThank you for your email regarding '{subject}'. I have received your message and will review the details carefully. I will get back to you with a comprehensive response as soon as possible.\n\nBest regards"
        elif style == 'casual':
            return f"Hi there!\n\nThanks for reaching out about '{subject}'! I got your message and I'll take a look at everything you mentioned. I'll get back to you soon with a proper response.\n\nCheers!"
        elif style == 'brief':
            return f"Thanks for your email about '{subject}'. I'll review and respond soon."
        else:
            return f"Thank you for your message regarding '{subject}'. I will review your email and provide a detailed response shortly.\n\nBest regards"

    def categorize_emails(self, emails: List[Dict]) -> List[Dict]:
        """Categorize emails into categories."""
        try:
            categories = []
            for email in emails:
                # Simple categorization based on keywords
                subject = email.get('subject', '').lower()
                if any(word in subject for word in ['meeting', 'calendar', 'schedule']):
                    category = 'Meeting'
                elif any(word in subject for word in ['urgent', 'important', 'asap']):
                    category = 'Urgent'
                elif any(word in subject for word in ['invoice', 'payment', 'bill']):
                    category = 'Finance'
                else:
                    category = 'General'
                
                categories.append({
                    'id': email.get('id'),
                    'category': category,
                    'confidence': 0.8
                })
            
            return categories
            
        except Exception as e:
            self.logger.error(f"Error categorizing emails: {str(e)}")
            return []

    def extract_action_items(self, email_content: str) -> List[Dict]:
        """Extract action items from email content."""
        try:
            # Simple keyword-based action item extraction
            action_items = []
            lines = email_content.split('\n')
            
            for line in lines:
                line_lower = line.lower().strip()
                if any(phrase in line_lower for phrase in ['please', 'need to', 'action required', 'todo', 'task']):
                    action_items.append({
                        'task': line.strip(),
                        'priority': 'medium',
                        'due_date': None
                    })
            
            return action_items[:5]  # Limit to 5 items
            
        except Exception as e:
            self.logger.error(f"Error extracting action items: {str(e)}")
            return [] 