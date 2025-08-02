import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Alert,
  Linking,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

// Backend URLs - Note: Both services run on the same ngrok URL but different paths
const CALENDAR_BACKEND_URL = 'https://5ef39224041b.ngrok-free.app/schedule-agent';
const GMAIL_BACKEND_URL = 'https://5ef39224041b.ngrok-free.app';

interface AuthScreenProps {
  onAuthComplete: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthComplete }) => {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('user_' + Date.now());
  const [authStep, setAuthStep] = useState<'welcome' | 'permissions' | 'calendar' | 'gmail' | 'complete'>('welcome');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    animateEntrance();
    checkExistingAuth();
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

  const checkExistingAuth = async () => {
    try {
      // Check for existing calendar tokens
      const calendarRead = await AsyncStorage.getItem('consent_token_read');
      const calendarUserId = await AsyncStorage.getItem('user_id');
      
      // Check for existing Gmail tokens
      const gmailRead = await AsyncStorage.getItem('gmail_consent_token_read');
      const gmailUserId = await AsyncStorage.getItem('gmail_user_id');
      
      console.log('🔍 Checking existing auth:', {
        hasCalendar: !!calendarRead,
        hasGmail: !!gmailRead,
        calendarUserId,
        gmailUserId
      });
      
      setCalendarConnected(!!calendarRead);
      setGmailConnected(!!gmailRead);
      
      if (calendarRead && gmailRead) {
        setAuthStep('complete');
      } else if (calendarRead || gmailRead) {
        setAuthStep('permissions');
      }
    } catch (error) {
      console.log('Error checking existing auth:', error);
    }
  };

  // Handle OAuth callbacks
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      console.log('📱 Auth received URL:', url);
      
      if (url.startsWith('myapp://oauth-success')) {
        try {
          const params = new URLSearchParams(url.split('?')[1]);
          const type = params.get('type');
          
          if (type === 'calendar') {
            await handleCalendarCallback(params);
          } else if (type === 'gmail') {
            await handleGmailCallback(params);
          }
        } catch (error) {
          console.log('❌ OAuth callback error:', error);
          Alert.alert('❌ Error', 'Authentication failed');
        }
      }
    };
    
    Linking.addEventListener('url', handleUrl);
    return () => Linking.removeAllListeners('url');
  }, []);

  const handleCalendarCallback = async (params: URLSearchParams) => {
    const tokenRead = params.get('consent_token_read') || '';
    const tokenWrite = params.get('consent_token_write') || '';
    const uid = params.get('user_id') || userId;
    const next = params.get('next');
    
    console.log('📅 Saving calendar tokens');
    
    // Save calendar tokens
    await AsyncStorage.setItem('consent_token_read', tokenRead);
    await AsyncStorage.setItem('consent_token_write', tokenWrite);
    await AsyncStorage.setItem('user_id', uid);
    
    setCalendarConnected(true);
    setUserId(uid);
    
    // If next=gmail, automatically start Gmail auth
    if (next === 'gmail') {
      console.log('🔄 Automatically starting Gmail authentication...');
      setTimeout(() => {
        startGmailAuth();
      }, 1000); // Small delay for UX
    } else {
      checkAuthCompletion();
    }
  };

  const handleGmailCallback = async (params: URLSearchParams) => {
    const tokenRead = params.get('consent_token_read') || '';
    const tokenWrite = params.get('consent_token_write') || '';
    const uid = params.get('user_id') || userId;
    
    console.log('📧 Saving Gmail tokens');
    
    // Save Gmail tokens
    await AsyncStorage.setItem('gmail_consent_token_read', tokenRead);
    await AsyncStorage.setItem('gmail_consent_token_write', tokenWrite);
    await AsyncStorage.setItem('gmail_user_id', uid);
    
    setGmailConnected(true);
    checkAuthCompletion();
  };

  const checkAuthCompletion = () => {
    if (calendarConnected && gmailConnected) {
      setAuthStep('complete');
      setTimeout(() => {
        Alert.alert('🎉 Success', 'All services connected successfully!', [
          { text: 'Continue', onPress: onAuthComplete }
        ]);
      }, 500);
    }
  };

  const startCalendarAuth = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting calendar authentication...');
      
      const res = await axios.get(`${CALENDAR_BACKEND_URL}/auth/google`, {
        params: { user_id: userId }
      });
      
      Linking.openURL(res.data.auth_url);
    } catch (error) {
      console.log('❌ Calendar auth error:', error);
      Alert.alert('❌ Error', 'Failed to start calendar authentication');
    } finally {
      setLoading(false);
    }
  };

  const startGmailAuth = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting Gmail authentication...');
      
      const res = await axios.get(`${GMAIL_BACKEND_URL}/inbox-agent/auth/gmail`, {
        params: { user_id: userId }
      });
      
      Linking.openURL(res.data.auth_url);
    } catch (error) {
      console.log('❌ Gmail auth error:', error);
      Alert.alert('❌ Error', 'Failed to start Gmail authentication');
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.welcomeTitle}>🤖 Welcome to Your PDA</Text>
      <Text style={styles.welcomeSubtitle}>Personal Data Agent</Text>
      
      <View style={styles.featureList}>
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>📅</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Smart Calendar</Text>
            <Text style={styles.featureDesc}>AI-powered scheduling and meeting optimization</Text>
          </View>
        </View>
        
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>📧</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Inbox Intelligence</Text>
            <Text style={styles.featureDesc}>Email analysis and content generation</Text>
          </View>
        </View>
        
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>🧠</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>AI Insights</Text>
            <Text style={styles.featureDesc}>Smart suggestions and automated actions</Text>
          </View>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={() => setAuthStep('permissions')}
      >
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🔐 Connect Your Services</Text>
      <Text style={styles.stepSubtitle}>
        Grant permissions to enable your PDA's full capabilities
      </Text>
      
      <View style={styles.permissionList}>
        <View style={styles.permissionItem}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionIcon}>📅</Text>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Google Calendar</Text>
              <Text style={styles.permissionDesc}>Schedule meetings, check availability</Text>
            </View>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: calendarConnected ? '#10B981' : '#F59E0B' }
            ]}>
              <Text style={styles.statusText}>
                {calendarConnected ? '✓' : '!'}
              </Text>
            </View>
          </View>
          {!calendarConnected && (
            <TouchableOpacity 
              style={styles.connectButton}
              onPress={startCalendarAuth}
              disabled={loading}
            >
              <Text style={styles.connectButtonText}>
                {loading ? 'Connecting...' : 'Connect Calendar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.permissionItem}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionIcon}>📧</Text>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Gmail</Text>
              <Text style={styles.permissionDesc}>Read emails, generate insights</Text>
            </View>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: gmailConnected ? '#10B981' : '#F59E0B' }
            ]}>
              <Text style={styles.statusText}>
                {gmailConnected ? '✓' : '!'}
              </Text>
            </View>
          </View>
          {!gmailConnected && (
            <TouchableOpacity 
              style={styles.connectButton}
              onPress={startGmailAuth}
              disabled={loading}
            >
              <Text style={styles.connectButtonText}>
                {loading ? 'Connecting...' : 'Connect Gmail'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {calendarConnected && gmailConnected && (
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={onAuthComplete}
        >
          <Text style={styles.primaryButtonText}>Continue to App</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.completeIcon}>🎉</Text>
      <Text style={styles.completeTitle}>All Set!</Text>
      <Text style={styles.completeSubtitle}>
        Your PDA is ready with full access to your services
      </Text>
      
      <View style={styles.connectedServices}>
        <View style={styles.connectedService}>
          <Text style={styles.connectedIcon}>📅</Text>
          <Text style={styles.connectedText}>Calendar Connected</Text>
        </View>
        <View style={styles.connectedService}>
          <Text style={styles.connectedIcon}>📧</Text>
          <Text style={styles.connectedText}>Gmail Connected</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={onAuthComplete}
      >
        <Text style={styles.primaryButtonText}>Enter Your PDA</Text>
      </TouchableOpacity>
    </View>
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
        <ScrollView showsVerticalScrollIndicator={false}>
          {authStep === 'welcome' && renderWelcome()}
          {authStep === 'permissions' && renderPermissions()}
          {authStep === 'complete' && renderComplete()}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366F1',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
    minHeight: height - 100,
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 48,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  featureList: {
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  permissionList: {
    marginBottom: 32,
  },
  permissionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  primaryButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  completeIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  connectedServices: {
    marginBottom: 32,
  },
  connectedService: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  connectedIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  connectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default AuthScreen; 