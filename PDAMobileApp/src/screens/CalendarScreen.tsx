import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator, 
  TextInput,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  SafeAreaView,
  RefreshControl,
  Animated,
  Modal,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { calendarService } from '../services/calendar';
import { apiService } from '../services/api';
// Define types for events and slots
interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
}

interface FreeSlot {
  start: Date;
  end: Date;
}

const { width, height } = Dimensions.get('window');
const BACKEND_URL = 'https://5ef39224041b.ngrok-free.app/schedule-agent';

const CalendarScreen = () => {
  // State variables
  const [hasCalendarPermission, setHasCalendarPermission] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [agentResponse, setAgentResponse] = useState<string>('');
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [userId, setUserId] = useState('');
  const [consentTokenRead, setConsentTokenRead] = useState('');
  const [consentTokenWrite, setConsentTokenWrite] = useState('');
  const [backendEvents, setBackendEvents] = useState<any[]>([]);
  const [backendFreeSlots, setBackendFreeSlots] = useState<any[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState<Date>(new Date());
  const [eventEnd, setEventEnd] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [preferences, setPreferences] = useState<any>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [suggestedTime, setSuggestedTime] = useState('');
  const [meetingFor, setMeetingFor] = useState<'myself' | 'other'>('myself');
  const [otherEmail, setOtherEmail] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [smartCreateMode, setSmartCreateMode] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    requestCalendarAccess();
    animateEntrance();
  }, []);

  useEffect(() => {
    const restoreTokens = async () => {
      console.log('🔄 Restoring calendar screen tokens...');
      const read = await AsyncStorage.getItem('consent_token_read');
      const write = await AsyncStorage.getItem('consent_token_write');
      const uid = await AsyncStorage.getItem('user_id');
      
      console.log('📋 Calendar token restoration:', {
        hasRead: !!read,
        hasWrite: !!write,
        hasUserId: !!uid,
        readTokenStart: read ? read.slice(0, 20) : 'none'
      });
      
      if (read) setConsentTokenRead(read);
      if (write) setConsentTokenWrite(write);
      if (uid) setUserId(uid);
      
      // Add small delay to ensure state updates complete before auto-sync
      if (read && uid) {
        setTimeout(() => {
          console.log('⏰ Triggering delayed auto-sync check...');
        }, 100);
      }
    };
    restoreTokens();
  }, []);

  const animateEntrance = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Deep link handling
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      if (url.startsWith('myapp://oauth-success')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const consentTokenRead = params.get('consent_token_read') ?? '';
        const consentTokenWrite = params.get('consent_token_write') ?? '';
        const userId = params.get('user_id') ?? '';
        setConsentTokenRead(String(consentTokenRead));
        setConsentTokenWrite(String(consentTokenWrite));
        setUserId(String(userId));
        AsyncStorage.setItem('consent_token_read', String(consentTokenRead));
        AsyncStorage.setItem('consent_token_write', String(consentTokenWrite));
        AsyncStorage.setItem('user_id', String(userId));
        Alert.alert('🎉 Success', 'Google Calendar connected successfully!');
      }
    };
    Linking.addEventListener('url', handleUrl);
    return () => Linking.removeAllListeners('url');
  }, []);

  // Google OAuth Flow
  const startGoogleAuth = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/auth/google`, {
        params: { user_id: userId }
      });
      const { auth_url } = res.data;
      Linking.openURL(auth_url);
    } catch (err: any) {
      console.log(err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to start Google OAuth');
    }
  };

  // Handle OAuth Callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      const codeMatch = url.match(/code=([^&]+)/);
      if (codeMatch) {
        const code = codeMatch[1];
        await axios.get(`${BACKEND_URL}/auth/google/callback`, {
          params: { code, user_id: userId }
        });
        Alert.alert('🎉 Success', 'Google Calendar connected!');
        await AsyncStorage.setItem('user_id', userId);
        setConsentTokenRead('demo-consent-token-read');
        setConsentTokenWrite('demo-consent-token-write');
      }
    };
    Linking.addEventListener('url', handleUrl);
    return () => Linking.removeAllListeners('url');
  }, []);

  const getFreeBusy = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/calendar/freebusy`, {
        params: {
          token: consentTokenRead,
          user_id: userId,
          time_min: new Date().toISOString(),
          time_max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      setBackendFreeSlots(res.data.calendars.primary.busy || []);
      setBackendEvents([]);
    } catch (err: any) {
      console.log('Error in getFreeBusy:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to fetch free/busy slots');
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  const createEvent = async () => {
    try {
      if (!eventTitle) {
        Alert.alert('Validation', 'Please enter an event title.');
        return;
      }
      if (!smartCreateMode && eventEnd <= eventStart) {
        Alert.alert('Validation', 'End time must be after start time.');
        return;
      }
      if (meetingFor === 'other' && !otherEmail) {
        Alert.alert('Validation', 'Please enter the Gmail address of the other user.');
        return;
      }
      
      setLoading(true);
      
      if (smartCreateMode) {
        // Use AI to find optimal time
        const duration = Math.round((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60));
        const res = await axios.post(`${BACKEND_URL}/calendar/smart-create`, null, {
          params: {
            token: consentTokenWrite,
            user_id: userId,
            title: eventTitle,
            duration_minutes: duration,
          },
        });
        
        Alert.alert('🤖 AI Scheduled!', res.data.message);
        setAiSuggestion(res.data.ai_suggestion);
      } else {
        // Manual time selection
        const eventData = {
          summary: eventTitle,
          start: { 
            dateTime: eventStart.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: { 
            dateTime: eventEnd.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          ...(meetingFor === 'other' && otherEmail ? {
            attendees: [{ email: otherEmail }],
            conferenceData: {
              createRequest: {
                requestId: `${Date.now()}-meet`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
              }
            }
          } : {})
        };
        
        const res = await axios.post(`${BACKEND_URL}/calendar/create`, {
          token: consentTokenWrite,
          user_id: userId,
          event_data: eventData,
        });
        
        Alert.alert('✅ Event Created', res.data.event.summary || 'Event created successfully!');
      }
      
      setShowEventForm(false);
      resetEventForm();
      await fetchGoogleEvents(); // Refresh events
    } catch (err: any) {
      console.log('Error in createEvent:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const resetEventForm = () => {
    setEventTitle('');
    setEventStart(new Date());
    setEventEnd(new Date(Date.now() + 60 * 60 * 1000));
    setMeetingFor('myself');
    setOtherEmail('');
    setSmartCreateMode(false);
    setAiSuggestion(null);
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  // Helper functions for custom date/time picker
  const generateDateOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      options.push({
        label,
        value: date.toISOString().split('T')[0],
        date: new Date(date)
      });
    }
    return options;
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date();
        displayTime.setHours(hour, minute);
        const label = displayTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
        options.push({
          label,
          value: timeStr,
          hour,
          minute
        });
      }
    }
    return options;
  };

  const updateDateTime = (date: Date, timeStr: string, setterFunction: (date: Date) => void) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    setterFunction(newDate);
  };

  const requestCalendarAccess = async () => {
    try {
      const hasPermission = await calendarService.checkPermission();
      if (!hasPermission) {
        const granted = await calendarService.requestPermission();
        setHasCalendarPermission(granted);
        if (granted) {
          Alert.alert(
            '🎉 Welcome!',
            'This app helps you manage your calendar using AI. I\'ll analyze your schedule to find free time slots and help you organize your day.'
          );
          fetchCalendarEvents();
        }
      } else {
        setHasCalendarPermission(true);
        fetchCalendarEvents();
      }
    } catch (error) {
      console.error('Error requesting calendar access:', error);
      Alert.alert('❌ Error', 'Failed to request calendar access');
    }
  };

  const fetchCalendarEvents = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      if (!hasCalendarPermission) {
        await requestCalendarAccess();
        return;
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const calendarEvents = await calendarService.getEvents(startDate, endDate);
      setEvents(calendarEvents);

      const busyTimes = calendarEvents.map((event: CalendarEvent) => ({
        start: new Date(event.startDate),
        end: new Date(event.endDate)
      }));

      const freeTimeSlots = findFreeTimeSlots(busyTimes, startDate, endDate);
      setFreeSlots(freeTimeSlots);

      // try {
      //   const response = await apiService.analyzeCalendar(calendarEvents, freeTimeSlots);
      //   setAgentResponse(response.message || '');
      // } catch (error: any) {
      //   if (error instanceof Error) {
      //     console.error('Error getting AI analysis:', error.message);
      //     Alert.alert('❌ Analysis Error', error.message);
      //   }
      // }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      Alert.alert('❌ Error', 'Failed to fetch calendar events');
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  const findFreeTimeSlots = (busyTimes: { start: Date; end: Date }[], startDate: Date, endDate: Date): FreeSlot[] => {
    const workingHourStart = 9;
    const workingHourEnd = 17;
    const slots: FreeSlot[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStart = new Date(current.setHours(workingHourStart, 0, 0, 0));
      const dayEnd = new Date(current.setHours(workingHourEnd, 0, 0, 0));

      let timeSlotStart = dayStart;
      const dayBusyTimes = busyTimes.filter(time =>
        time.start.getDate() === current.getDate() &&
        time.start.getMonth() === current.getMonth()
      ).sort((a, b) => a.start.getTime() - b.start.getTime());

      dayBusyTimes.forEach(busy => {
        if (timeSlotStart < busy.start) {
          slots.push({
            start: new Date(timeSlotStart),
            end: new Date(busy.start)
          });
        }
        timeSlotStart = busy.end;
      });

      if (timeSlotStart < dayEnd) {
        slots.push({
          start: new Date(timeSlotStart),
          end: new Date(dayEnd)
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  };

  const fetchGoogleEvents = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await axios.get(`${BACKEND_URL}/calendar/events`, {
        params: {
          token: consentTokenRead,
          user_id: userId,
          time_min: now,
          time_max: future,
        },
      });
      setGoogleEvents(res.data.items || []);
    } catch (err: any) {
      console.log('Error in fetchGoogleEvents:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to fetch Google events');
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  const logout = async () => {
    Alert.alert(
      '🚪 Logout',
      'Are you sure you want to disconnect your Google Calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            setConsentTokenRead('');
            setConsentTokenWrite('');
            setUserId('');
            setGoogleEvents([]);
            setBackendFreeSlots([]);
            setPreferences(null);
            setAgentResponse('');
            await AsyncStorage.removeItem('consent_token_read');
            await AsyncStorage.removeItem('consent_token_write');
            await AsyncStorage.removeItem('user_id');
            Alert.alert('✅ Disconnected', 'Your Google Calendar has been disconnected successfully.');
          }
        }
      ]
    );
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setLoading(false); // Ensure loading is off during refresh
    
    try {
      // Always fetch local calendar events
      await fetchCalendarEvents(true); // Skip loading since we're using refresh indicator
      
      // If connected to Google, fetch Google data
      if (consentTokenRead && userId) {
        await Promise.all([
          fetchGoogleEvents(true), // Skip loading since we're using refresh indicator
          getFreeBusy(true), // Skip loading since we're using refresh indicator
          fetchPreferences()
        ]);
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
      setLoading(false); // Ensure loading is off
    }
  }, [consentTokenRead, userId]);

  const handleSuggestTime = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/calendar/suggest-time`, {
        params: { token: consentTokenRead, user_id: userId }
      });
      setSuggestedTime(
        typeof res.data.suggested_time === 'string' && res.data.suggested_time ? res.data.suggested_time :
        typeof res.data.reason === 'string' && res.data.reason ? res.data.reason :
        ''
      );
    } catch (e) {
      setSuggestedTime('Could not suggest a time.');
    }
  };

  const fetchPreferences = async () => {
    setPreferencesLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/calendar/preferences`, {
        params: { token: consentTokenRead, user_id: userId }
      });
      setPreferences(res.data);
    } catch (e) {
      setPreferences(null);
    } finally {
      setPreferencesLoading(false);
    }
  };

  useEffect(() => {
    if (consentTokenRead && userId) {
      console.log('🔍 Auto-sync triggered with:', {
        tokenLength: consentTokenRead.length,
        tokenStart: consentTokenRead.slice(0, 20),
        userId: userId
      });
      
      // Try to determine if this is a calendar token
      let isCalendarToken = false;
      let shouldAttemptCalendarSync = false;
      
      try {
        // Try parsing the token to check for calendar scope
        const tokenParts = consentTokenRead.split(':');
        if (tokenParts.length >= 2) {
          const tokenPayload = tokenParts[1];
          const decodedToken = atob(tokenPayload);
          console.log('🔍 Decoded token snippet:', decodedToken.slice(0, 100));
          
          if (decodedToken.includes('calendar')) {
            isCalendarToken = true;
            shouldAttemptCalendarSync = true;
            console.log('📅 Calendar token detected via parsing');
          } else if (decodedToken.includes('gmail')) {
            console.log('📧 Gmail token detected - skipping calendar auto-sync');
            return;
          }
        }
      } catch (error) {
        console.log('⚠️ Token parsing failed:', error);
        // Fallback: if we can't parse the token, but we have calendar tokens stored,
        // assume this might be a calendar token and try the sync
        shouldAttemptCalendarSync = true;
        console.log('🔄 Attempting calendar sync as fallback');
      }
      
      // If we think this is a calendar token, or as a fallback, try to sync
      if (shouldAttemptCalendarSync) {
        console.log('📅 Starting calendar auto-sync...');
        fetchPreferences();
        fetchGoogleEvents();
        getFreeBusy();
      }
    }
  }, [consentTokenRead, userId]);

  const renderConnectionStatus = () => (
    <View style={styles.connectionCard}>
      {!consentTokenRead ? (
        <View>
          <View style={styles.connectionHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.connectionTitle}>🔗 Connect Calendar</Text>
          </View>
          <Text style={styles.connectionSubtitle}>
            Connect your Google Calendar to enable AI-powered scheduling
          </Text>
          <TouchableOpacity style={styles.connectButton} onPress={startGoogleAuth}>
            <Text style={styles.connectButtonText}>Connect Google Calendar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.connectedHeader}>
          <View style={styles.connectionInfo}>
            <View style={[styles.statusIndicator, { backgroundColor: '#4CAF50' }]} />
            <View>
              <Text style={styles.connectionTitle}>🔗 Connected</Text>
              <Text style={styles.connectionSubtitle}>
                Auto-syncing with Google Calendar
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButtonSimple} onPress={logout}>
            <Text style={styles.logoutButtonSimpleText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { key: 'overview', title: '📊 Overview', icon: '📊' },
        { key: 'events', title: '📅 Events', icon: '📅' },
        { key: 'slots', title: '⏰ Free Time', icon: '⏰' }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.icon}
          </Text>
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.title.replace(/📊|📅|⏰\s/, '')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {agentResponse && (
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>🤖 AI Assistant</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>Smart</Text>
            </View>
          </View>
          <Text style={styles.aiResponse}>{agentResponse}</Text>
        </View>
      )}
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{events.length + googleEvents.length}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
          <Text style={styles.statIcon}>📅</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{freeSlots.length}</Text>
          <Text style={styles.statLabel}>Free Slots</Text>
          <Text style={styles.statIcon}>⏰</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{backendFreeSlots.length}</Text>
          <Text style={styles.statLabel}>Busy Periods</Text>
          <Text style={styles.statIcon}>🔴</Text>
        </View>
      </View>
      <View style={styles.preferencesCard}>
        <Text style={styles.sectionTitle}>🧠 Learned Preferences</Text>
        {preferencesLoading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : preferences ? (
          <>
            <Text>Most common meeting hour: <Text style={styles.bold}>{preferences.most_common_hour}:00</Text></Text>
            <Text>Preferred day: <Text style={styles.bold}>{preferences.most_common_day}</Text></Text>
            <Text>Average duration: <Text style={styles.bold}>{preferences.avg_duration_minutes} min</Text></Text>
          </>
        ) : (
          <Text>No data yet. Connect your calendar and add events!</Text>
        )}
        <TouchableOpacity style={styles.suggestButton} onPress={handleSuggestTime}>
          <Text style={styles.suggestButtonText}>Suggest Time</Text>
        </TouchableOpacity>
        {suggestedTime ? (
          <Text style={styles.suggestedTimeText}>Suggested: {suggestedTime}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderEvents = () => (
    <View style={styles.tabContent}>
      {googleEvents.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>📅 Google Calendar Events</Text>
          {googleEvents.map((event, index) => (
            <View key={index} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.summary || 'Untitled Event'}</Text>
                <View style={styles.eventBadge}>
                  <Text style={styles.eventBadgeText}>Google</Text>
                </View>
              </View>
              <Text style={styles.eventTime}>
                {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'No Start'}
                {' - '}
                {event.end?.dateTime ? new Date(event.end.dateTime).toLocaleString() : 'No End'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* {events.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>📱 Local Events</Text>
          {events.map((event, index) => (
            <View key={index} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={[styles.eventBadge, styles.localBadge]}>
                  <Text style={styles.eventBadgeText}>Local</Text>
                </View>
              </View>
              <Text style={styles.eventTime}>
                {new Date(event.startDate).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )} */}
    </View>
  );

  const renderFreeSlots = () => (
    <View style={styles.tabContent}>
      {freeSlots.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>⏰ Available Time Slots</Text>
          {freeSlots.map((slot, index) => (
            <View key={index} style={styles.freeSlotCard}>
              <View style={styles.freeSlotHeader}>
                <Text style={styles.freeSlotTitle}>🟢 Free Time</Text>
                <Text style={styles.freeSlotDuration}>
                  {Math.round((slot.end.getTime() - slot.start.getTime()) / (1000 * 60 * 60))}h
                </Text>
              </View>
              <Text style={styles.freeSlotTime}>
                {slot.start.toLocaleTimeString()} - {slot.end.toLocaleTimeString()}
              </Text>
              <Text style={styles.freeSlotDate}>
                {slot.start.toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {backendFreeSlots.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>🔴 Busy Periods</Text>
          {backendFreeSlots.map((slot, index) => (
            <View key={index} style={styles.busySlotCard}>
              <View style={styles.busySlotHeader}>
                <Text style={styles.busySlotTitle}>🔴 Busy</Text>
              </View>
              <Text style={styles.busySlotTime}>{slot.start} - {slot.end}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderCreateEventModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEventForm}
      onRequestClose={() => setShowEventForm(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✨ Create New Event</Text>
            <TouchableOpacity onPress={() => setShowEventForm(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Meeting For</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setMenuVisible(!menuVisible)}
            >
              <Text style={styles.dropdownButtonText}>
                {meetingFor === 'myself' ? '👤 Myself' : '👥 Other (Gmail)'}
              </Text>
              <Text style={[styles.dropdownArrow, { transform: [{ rotate: menuVisible ? '180deg' : '0deg' }] }]}>▼</Text>
            </TouchableOpacity>
            
            {menuVisible && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={[styles.dropdownItem, meetingFor === 'myself' && styles.dropdownItemSelected]}
                  onPress={() => {
                    setMeetingFor('myself');
                    setMenuVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, meetingFor === 'myself' && styles.dropdownItemTextSelected]}>
                    👤 Myself
                  </Text>
                  {meetingFor === 'myself' && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.dropdownItem, meetingFor === 'other' && styles.dropdownItemSelected]}
                  onPress={() => {
                    setMeetingFor('other');
                    setMenuVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, meetingFor === 'other' && styles.dropdownItemTextSelected]}>
                    👥 Other (Gmail)
                  </Text>
                  {meetingFor === 'other' && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              </View>
            )}
            
            {meetingFor === 'other' && (
              <TextInput
                style={[styles.formInput, { marginTop: 12 }]}
                placeholder="Enter Gmail address"
                value={otherEmail}
                onChangeText={text => setOtherEmail(text || '')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Event Title</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter event title"
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.toggleRow}>
              <Text style={styles.formLabel}>Smart Scheduling</Text>
              <TouchableOpacity
                style={[styles.toggle, smartCreateMode && styles.toggleActive]}
                onPress={() => setSmartCreateMode(!smartCreateMode)}
              >
                <Text style={[styles.toggleText, smartCreateMode && styles.toggleTextActive]}>
                  {smartCreateMode ? '🤖 AI' : '📅 Manual'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.toggleDescription}>
              {smartCreateMode 
                ? 'AI will find the optimal time based on your patterns' 
                : 'Choose your own date and time'
              }
            </Text>
          </View>

          {!smartCreateMode && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Start Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity 
                    style={[styles.dateTimeButton, { flex: 2 }]} 
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      📅 {eventStart.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.dateTimeButton, { flex: 1 }]} 
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      🕐 {eventStart.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>End Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity 
                    style={[styles.dateTimeButton, { flex: 2 }]} 
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      📅 {eventEnd.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.dateTimeButton, { flex: 1 }]} 
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={styles.dateTimeButtonText}>
                      🕐 {eventEnd.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {smartCreateMode && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="60"
                value={String(Math.round((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60)))}
                onChangeText={(text) => {
                  const minutes = parseInt(text) || 60;
                  setEventEnd(new Date(eventStart.getTime() + minutes * 60 * 1000));
                }}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          )}

          {aiSuggestion && (
            <View style={styles.aiSuggestionCard}>
              <Text style={styles.aiSuggestionTitle}>🤖 AI Suggestion</Text>
              <Text style={styles.aiSuggestionText}>
                Confidence: {(aiSuggestion.confidence * 100).toFixed(0)}%
              </Text>
              <Text style={styles.aiSuggestionReason}>{aiSuggestion.reason}</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowEventForm(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={createEvent} disabled={loading}>
              <Text style={styles.createButtonText}>
                {loading ? 'Creating...' : 'Create Event'}
              </Text>
            </TouchableOpacity>
          </View>


        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366F1" />
      
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Calendar Assistant</Text>
          <Text style={styles.headerSubtitle}>Smart scheduling made simple</Text>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
          }
        >
          {renderConnectionStatus()}
          {renderTabBar()}
          
          {loading && !refreshing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'slots' && renderFreeSlots()}
        </ScrollView>

        {/* Floating Action Button */}
        {consentTokenWrite && (
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => setShowEventForm(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}

        {renderCreateEventModal()}
        
        {/* Custom Date Picker Modals */}
        {showStartDatePicker && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showStartDatePicker}
            onRequestClose={() => setShowStartDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Start Date</Text>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerList}>
                  {generateDateOptions().map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerItem}
                      onPress={() => {
                        const currentTime = eventStart.toTimeString().slice(0, 5);
                        updateDateTime(option.date, currentTime, setEventStart);
                        setShowStartDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{option.label}</Text>
                      <Text style={styles.pickerItemSubtext}>{option.date.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {showStartTimePicker && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showStartTimePicker}
            onRequestClose={() => setShowStartTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Start Time</Text>
                  <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerList}>
                  {generateTimeOptions().map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerItem}
                      onPress={() => {
                        updateDateTime(eventStart, option.value, setEventStart);
                        setShowStartTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {showEndDatePicker && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showEndDatePicker}
            onRequestClose={() => setShowEndDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select End Date</Text>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerList}>
                  {generateDateOptions().map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerItem}
                      onPress={() => {
                        const currentTime = eventEnd.toTimeString().slice(0, 5);
                        updateDateTime(option.date, currentTime, setEventEnd);
                        setShowEndDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{option.label}</Text>
                      <Text style={styles.pickerItemSubtext}>{option.date.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {showEndTimePicker && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showEndTimePicker}
            onRequestClose={() => setShowEndTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select End Time</Text>
                  <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerList}>
                  {generateTimeOptions().map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerItem}
                      onPress={() => {
                        updateDateTime(eventEnd, option.value, setEventEnd);
                        setShowEndTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
                 )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  dropdownArrow: {
  fontSize: 12,
  color: '#6B7280',
  marginLeft: 'auto',
},
dropdownButton: {
  backgroundColor: '#F9FAFB',
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  marginBottom: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  connectionCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  connectButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  connectedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 4,
  },
  activeTabText: {
    color: 'white',
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  aiCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  aiBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  aiResponse: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginTop: 8,
  },
  eventsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  eventBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  localBadge: {
    backgroundColor: '#F3E8FF',
  },
  eventBadgeText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  freeSlotCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  freeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  freeSlotTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  freeSlotDuration: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  freeSlotTime: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  freeSlotDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  busySlotCard: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  busySlotHeader: {
    marginBottom: 8,
  },
  busySlotTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  busySlotTime: {
    fontSize: 14,
    color: '#374151',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: 'white',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  preferencesCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  suggestButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  suggestedTimeText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  bold: {
    fontWeight: 'bold',
  },
  
  dropdownButtonText: {
    fontSize: 16,
    color: '#1F2937',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggle: {
    width: 100,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
    marginLeft:8,
  },
  toggleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  toggleText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: 'white',
  },
  toggleDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  aiSuggestionCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  aiSuggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
    aiSuggestionReason: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  dateTimeButtonText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  pickerModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  pickerItemSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  connectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  connectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoutButtonSimple: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonSimpleText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  });
  
export default CalendarScreen;