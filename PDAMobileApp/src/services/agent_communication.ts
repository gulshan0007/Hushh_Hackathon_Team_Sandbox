import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConsentScope, AgentMessage } from '../types/consent';

const BACKEND_URL = 'https://5ef39224041b.ngrok-free.app';

class AgentCommunicationService {
  private static instance: AgentCommunicationService;
  private userId: string = '';
  private gmailToken: string = '';
  private calendarToken: string = '';

  private constructor() {
    // Initialize immediately
    this.initialize().catch(err => {
      console.error('Failed to initialize AgentCommunicationService:', err);
    });
  }

  public static getInstance(): AgentCommunicationService {
    if (!AgentCommunicationService.instance) {
      AgentCommunicationService.instance = new AgentCommunicationService();
    }
    return AgentCommunicationService.instance;
  }

  public async initialize() {
    try {
      // Load tokens from storage
      const [userId, gmailToken, calendarToken] = await Promise.all([
        AsyncStorage.getItem('gmail_user_id'),
        AsyncStorage.getItem('gmail_consent_token_read'),
        AsyncStorage.getItem('consent_token_read')
      ]);

      if (userId) {
        // Normalize user ID to ensure single underscore
        this.userId = userId.replace(/__+/g, '_');
        console.log('🔑 Normalized user ID:', this.userId);
      }
      if (gmailToken) this.gmailToken = gmailToken;
      if (calendarToken) this.calendarToken = calendarToken;

      console.log('🔧 AgentCommunicationService initialized:', {
        hasUserId: !!userId,
        hasGmailToken: !!gmailToken,
        hasCalendarToken: !!calendarToken
      });

      return true;
    } catch (error) {
      console.error('Error initializing agent communication:', error);
      return false;
    }
  }

  private async ensureInitialized() {
    if (!this.userId || !this.gmailToken || !this.calendarToken) {
      console.log('🔄 Re-initializing AgentCommunicationService...');
      await this.initialize();
    }

    if (!this.userId) {
      throw new Error('User ID not available. Please authenticate first.');
    }
  }

  private async ensureGmailToken() {
    await this.ensureInitialized();
    if (!this.gmailToken) {
      throw new Error('Gmail authentication token not available. Please authenticate with Gmail first.');
    }
  }

  private async ensureCalendarToken() {
    await this.ensureInitialized();
    if (!this.calendarToken) {
      throw new Error('Calendar authentication token not available. Please authenticate with Calendar first.');
    }
  }

  private async ensureBothTokens() {
    await this.ensureInitialized();
    if (!this.gmailToken || !this.calendarToken) {
      throw new Error('Authentication tokens not available. Please authenticate first.');
    }
  }

  // Email to Calendar Event
  public async createEventFromEmail(emailId: string, eventDetails: any) {
    try {
      await this.ensureBothTokens();

      console.log('📧 Creating event from email:', {
        emailId,
        userId: this.userId
      });

      const message: AgentMessage = {
        from_agent: 'inbox_agent',
        to_agent: 'schedule_agent',
        user_id: this.userId,
        message_type: 'email_to_event',
        payload: {
          email_id: emailId,
          event_details: eventDetails
        }
      };

      // Define required scopes for this operation
      const required_scopes = [
        ConsentScope.GMAIL_READ,
        ConsentScope.CALENDAR_WRITE
      ];

      const response = await axios.post(
        `${BACKEND_URL}/agent-communication/send`,
        {
          ...message,
          required_scopes
        },
        {
          headers: {
            'Gmail-Token': this.gmailToken,
            'Calendar-Token': this.calendarToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating event from email:', error);
      throw error;
    }
  }

  // Smart Reply Generation
  public async generateSmartReply(emailId: string, style: string = 'professional') {
    try {
      await this.ensureGmailToken();

      console.log('💬 Generating smart reply:', {
        emailId,
        userId: this.userId,
        style
      });

      const message = {
        token: this.gmailToken,
        user_id: this.userId,
        message_type: 'smart_reply',
        payload: {
          email_id: emailId,
          style: style
        }
      };

      const response = await axios.post(
        `${BACKEND_URL}/inbox-agent/generate`,
        message,
        {
          headers: {
            'Gmail-Token': this.gmailToken
          }
        }
      );

      return response.data.content;
    } catch (error) {
      console.error('Error generating smart reply:', error);
      throw error;
    }
  }

  // Schedule Conflict Notification
  public async checkScheduleConflicts(eventId: string) {
    try {
      await this.ensureBothTokens();

      console.log('🔄 Checking schedule conflicts:', {
        eventId,
        userId: this.userId
      });

      const message: AgentMessage = {
        from_agent: 'schedule_agent',
        to_agent: 'inbox_agent',
        user_id: this.userId,
        message_type: 'schedule_conflict',
        payload: {
          event_id: eventId
        }
      };

      // Define required scopes for this operation
      const required_scopes = [
        ConsentScope.CALENDAR_READ,
        ConsentScope.GMAIL_WRITE
      ];

      const response = await axios.post(
        `${BACKEND_URL}/agent-communication/send`,
        {
          ...message,
          required_scopes
        },
        {
          headers: {
            'Gmail-Token': this.gmailToken,
            'Calendar-Token': this.calendarToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error checking schedule conflicts:', error);
      throw error;
    }
  }

  // Email Reminder for Calendar Event
  public async setEmailReminder(eventId: string, reminderDetails: any) {
    try {
      await this.ensureBothTokens();

      console.log('📧 Setting email reminder:', {
        eventId,
        userId: this.userId
      });

      const message: AgentMessage = {
        from_agent: 'schedule_agent',
        to_agent: 'inbox_agent',
        user_id: this.userId,
        message_type: 'email_reminder',
        payload: {
          event_id: eventId,
          reminder_details: reminderDetails
        }
      };

      // Define required scopes for this operation
      const required_scopes = [
        ConsentScope.CALENDAR_READ,
        ConsentScope.GMAIL_WRITE
      ];

      const response = await axios.post(
        `${BACKEND_URL}/agent-communication/send`,
        {
          ...message,
          required_scopes
        },
        {
          headers: {
            'Gmail-Token': this.gmailToken,
            'Calendar-Token': this.calendarToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error setting email reminder:', error);
      throw error;
    }
  }

  // Contact Sync between Agents
  public async syncContacts() {
    try {
      await this.ensureBothTokens();

      console.log('🔄 Syncing contacts:', {
        userId: this.userId
      });

      const message: AgentMessage = {
        from_agent: 'inbox_agent',
        to_agent: 'schedule_agent',
        user_id: this.userId,
        message_type: 'contact_sync',
        payload: {}
      };

      // Define required scopes for this operation
      const required_scopes = [
        ConsentScope.GMAIL_READ,
        ConsentScope.CALENDAR_WRITE
      ];

      const response = await axios.post(
        `${BACKEND_URL}/agent-communication/send`,
        {
          ...message,
          required_scopes
        },
        {
          headers: {
            'Gmail-Token': this.gmailToken,
            'Calendar-Token': this.calendarToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error syncing contacts:', error);
      throw error;
    }
  }

  // Receive Messages for an Agent
  public async receiveMessages(agentId: string) {
    try {
      await this.ensureBothTokens();

      console.log('📥 Receiving messages for agent:', {
        agentId,
        userId: this.userId
      });

      const response = await axios.get(
        `${BACKEND_URL}/agent-communication/receive`,
        {
          params: {
            agent_id: agentId,
            user_id: this.userId
          },
          headers: {
            'Gmail-Token': this.gmailToken,
            'Calendar-Token': this.calendarToken
          }
        }
      );

      return response.data.messages;
    } catch (error) {
      console.error('Error receiving messages:', error);
      throw error;
    }
  }

  // Process Received Messages
  public async processMessages(agentId: string) {
    try {
      await this.ensureBothTokens();

      console.log('🔄 Processing messages for agent:', {
        agentId,
        userId: this.userId
      });

      const messages = await this.receiveMessages(agentId);
      
      for (const message of messages) {
        switch (message.message_type) {
          case 'email_to_event':
            // Handle calendar event creation
            console.log('Processing email to event:', message);
            break;
            
          case 'schedule_conflict':
            // Handle schedule conflict notification
            console.log('Processing schedule conflict:', message);
            break;
            
          case 'email_reminder':
            // Handle email reminder creation
            console.log('Processing email reminder:', message);
            break;
            
          default:
            console.log('Unknown message type:', message.message_type);
        }
      }
      
      return messages;
    } catch (error) {
      console.error('Error processing messages:', error);
      throw error;
    }
  }
}

export const agentCommunication = AgentCommunicationService.getInstance(); 