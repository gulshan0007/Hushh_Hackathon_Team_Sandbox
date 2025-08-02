/**
 * Consent Types for Personal Data Agents
 */

export enum ConsentScope {
  // Gmail Scopes
  GMAIL_READ = 'gmail.read',
  GMAIL_WRITE = 'gmail.write',
  
  // Calendar Scopes
  CALENDAR_READ = 'calendar.read',
  CALENDAR_WRITE = 'calendar.write',
  
  // AI Analysis Scopes
  AI_ANALYZE = 'ai.analyze',
  AI_GENERATE = 'ai.generate',
  
  // Document Processing Scopes
  DOCUMENT_READ = 'document.read',
  DOCUMENT_WRITE = 'document.write',
  
  // Contact Management Scopes
  CONTACT_READ = 'contact.read',
  CONTACT_WRITE = 'contact.write'
}

export interface ConsentToken {
  token: string;
  scope: ConsentScope;
  expires_at: number;
}

export interface TrustLink {
  from_agent: string;
  to_agent: string;
  scope: ConsentScope;
  created_at: number;
  expires_at: number;
  signed_by_user: string;
  signature: string;
}

export interface AgentMessage {
  from_agent: string;
  to_agent: string;
  user_id: string;
  message_type: string;
  payload: any;
  trust_link?: string;
} 