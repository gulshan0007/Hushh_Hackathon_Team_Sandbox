import axios, { AxiosError } from 'axios';
import { config } from '../config';
// import { logger } from '../utils/logger';

export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiService {
  private static instance: ApiService;
  private baseURL: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private constructor() {
    this.baseURL = config.API_URL;
    this.checkHealth(); // Initial health check
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async checkHealth(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.isHealthy = false;
      // logger.error('Health check failed:', error);
    }
  }

  private async ensureHealthy(): Promise<void> {
    if (!this.isHealthy || Date.now() - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
      await this.checkHealth();
    }
    if (!this.isHealthy) {
      throw new Error('Service is currently unavailable. Please try again later.');
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.ensureHealthy();
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (error instanceof AxiosError && error.response?.status === 429) {
          // Rate limit exceeded, wait longer before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
          continue;
        }
        if (attempt === this.MAX_RETRIES) break;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
    return this.handleError(lastError || new Error('Operation failed after multiple retries'));
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (error.response) {
        switch (error.response.status) {
          case 429:
            throw new Error('Rate limit exceeded. Please try again in a few moments.');
          case 400:
            throw new Error(`Invalid request: ${error.response.data?.message || 'Please check your input and try again.'}`);
          case 401:
            throw new Error('Authentication required. Please log in and try again.');
          case 403:
            throw new Error('Access denied. You do not have permission to perform this action.');
          case 404:
            throw new Error('The requested resource was not found.');
          case 500:
            throw new Error('Server error. Our team has been notified and is working on it.');
          default:
            throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
        }
      } else if (error.request) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        throw new Error('Network Error: Unable to reach the server. Please check your connection and try again.');
      }
    }
    if (error instanceof Error) {
      throw new Error(`Unexpected error: ${error.message}`);
    }
    throw new Error('An unknown error occurred. Please try again.');
  }

  async analyzeCalendar(events: CalendarEvent[], freeSlots: TimeSlot[]): Promise<ApiResponse<string>> {
    return this.executeWithRetry(async () => {
      const response = await axios.post<ApiResponse<string>>(
        `${this.baseURL}${config.API_ENDPOINTS.CHECK_CALENDAR}`,
        { events, freeSlots },
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    });
  }

  async checkWeather(location: string): Promise<ApiResponse<{ temperature: number; condition: string; forecast: string }>> {
    return this.executeWithRetry(async () => {
      const response = await axios.post<ApiResponse<{ temperature: number; condition: string; forecast: string }>>(
        `${this.baseURL}${config.API_ENDPOINTS.CHECK_WEATHER}`,
        { location },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    });
  }

  async setReminder(title: string, datetime: string, description?: string): Promise<ApiResponse<{ id: string; scheduled: boolean }>> {
    return this.executeWithRetry(async () => {
      const response = await axios.post<ApiResponse<{ id: string; scheduled: boolean }>>(
        `${this.baseURL}${config.API_ENDPOINTS.SET_REMINDER}`,
        { title, datetime, description },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    });
  }

  async searchInformation(query: string): Promise<ApiResponse<{ results: Array<{ title: string; content: string; relevance: number }> }>> {
    return this.executeWithRetry(async () => {
      const response = await axios.post<ApiResponse<{ results: Array<{ title: string; content: string; relevance: number }> }>>(
        `${this.baseURL}${config.API_ENDPOINTS.SEARCH_INFORMATION}`,
        { query },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    });
  }
}

export const apiService = ApiService.getInstance();