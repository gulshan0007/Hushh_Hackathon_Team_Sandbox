import RNCalendarEvents, { Calendar, Event } from 'react-native-calendar-events';
import { Platform } from 'react-native';

class CalendarService {
  private static instance: CalendarService;

  private constructor() {}

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  async requestPermission(): Promise<boolean> {
    try {
      const auth = await RNCalendarEvents.requestPermissions();
      return auth === 'authorized';
    } catch (error) {
      console.error('Error requesting calendar permission:', error);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    try {
      const auth = await RNCalendarEvents.checkPermissions();
      return auth === 'authorized';
    } catch (error) {
      console.error('Error checking calendar permission:', error);
      return false;
    }
  }

  async getCalendars(): Promise<Calendar[]> {
    try {
      return await RNCalendarEvents.findCalendars();
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [];
    }
  }

  async getEvents(startDate: Date, endDate: Date): Promise<Event[]> {
    try {
      return await RNCalendarEvents.fetchAllEvents(
        startDate.toISOString(),
        endDate.toISOString(),
      );
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async addEvent(title: string, startDate: Date, endDate: Date, notes?: string): Promise<string> {
    try {
      const eventId = await RNCalendarEvents.saveEvent(title, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes,
        alarms: [{
          date: 30 // 30 minutes before
        }]
      });
      return eventId;
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, title: string, startDate: Date, endDate: Date, notes?: string): Promise<string> {
    try {
      const updatedEventId = await RNCalendarEvents.saveEvent(title, {
        id: eventId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes,
        alarms: [{
          date: 30 // 30 minutes before
        }]
      });
      return updatedEventId;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await RNCalendarEvents.removeEvent(eventId);
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }
}

export const calendarService = CalendarService.getInstance();