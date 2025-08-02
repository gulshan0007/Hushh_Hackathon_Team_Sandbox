/**
 * Personal Data Agent Mobile App
 * @format
 */

import React, { useState, useEffect } from 'react';
import { 
  StatusBar, 
  View, 
  StyleSheet, 
  Dimensions, 
  Platform,
  SafeAreaView,
  Text 
} from 'react-native';
import { BottomNavigation } from 'react-native-paper';
import { Provider as PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarScreen from './src/screens/CalendarScreen';
import GmailScreen from './src/screens/GmailScreen';
import DemoScreen from './src/screens/DemoScreen';
import AuthScreen from './src/screens/AuthScreen';

const { width } = Dimensions.get('window');

// Custom icon component for emojis
const EmojiIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ 
    fontSize: focused ? 24 : 20, 
    opacity: focused ? 1 : 0.6 
  }}>
    {emoji}
  </Text>
);

function App() {
  const [index, setIndex] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [routes] = useState([
    { 
      key: 'calendar', 
      title: 'Calendar', 
      focusedIcon: '📅',
      unfocusedIcon: '📅'
    },
    { 
      key: 'gmail', 
      title: 'Gmail', 
      focusedIcon: '📧',
      unfocusedIcon: '📧'
    },
    { 
      key: 'demo', 
      title: 'Upcoming', 
      focusedIcon: '⭐',
      unfocusedIcon: '⭐'
    },
  ]);

  // Check authentication status on app launch
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      
      // Check for both calendar and Gmail tokens
      const calendarRead = await AsyncStorage.getItem('consent_token_read');
      const gmailRead = await AsyncStorage.getItem('gmail_consent_token_read');
      
      console.log('📊 Auth status:', {
        hasCalendar: !!calendarRead,
        hasGmail: !!gmailRead,
        isAuthenticated: !!(calendarRead && gmailRead)
      });
      
      // User is authenticated if they have both tokens
      // setIsAuthenticated(!!(calendarRead && gmailRead));
      setIsAuthenticated(!!(gmailRead));
    } catch (error) {
      console.log('❌ Error checking auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleAuthComplete = () => {
    console.log('✅ Authentication completed');
    setIsAuthenticated(true);
  };

  const renderScene = BottomNavigation.SceneMap({
    calendar: CalendarScreen,
    gmail: GmailScreen,
    demo: DemoScreen,
  });

  // Custom render icon function for emoji icons
  const renderIcon = ({ route, focused, color }: { route: any; focused: boolean; color: string }) => {
    const emoji = focused ? route.focusedIcon : route.unfocusedIcon;
    return <EmojiIcon emoji={emoji} focused={focused} />;
  };

  // Show loading or auth screen based on authentication status
  if (checkingAuth) {
    return (
      <PaperProvider>
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <StatusBar barStyle="light-content" backgroundColor="#6366F1" />
          <Text style={{ fontSize: 24 }}>⏳</Text>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <PaperProvider>
        <AuthScreen onAuthComplete={handleAuthComplete} />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#6366F1" 
          translucent={false}
        />
        
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerGradient}>
            <View style={styles.headerContent}>
              {/* Header content can be added here */}
            </View>
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.navigationContainer}>
          <BottomNavigation
            navigationState={{ index, routes }}
            onIndexChange={setIndex}
            renderScene={renderScene}
            renderIcon={renderIcon}
            barStyle={styles.bottomNavBar}
            activeColor="#6366F1"
            inactiveColor="#9CA3AF"
            shifting={false}
            labeled={true}
            theme={{
              colors: {
                surface: '#FFFFFF',
                primary: '#6366F1',
                secondaryContainer: '#F0F9FF',
              }
            }}
            style={styles.bottomNavigation}
          />
        </View>

        {/* Bottom Safe Area */}
        <View style={styles.bottomSafeArea} />
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 0, // Hidden for now, can be expanded later
    backgroundColor: '#6366F1',
  },
  headerGradient: {
    flex: 1,
    backgroundColor: '#6366F1',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  navigationContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 0,
    paddingHorizontal: 4,
  },
  bottomNavigation: {
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  bottomNavBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    paddingTop: 15,
    height: Platform.OS === 'ios' ? 95 : 80,
    borderRadius: 16,
    marginHorizontal: 8,
    marginBottom: Platform.OS === 'ios' ? 25 : 15,
  },
  bottomSafeArea: {
    backgroundColor: '#F8FAFC',
    paddingBottom: Platform.OS === 'ios' ? 0 : 8,
  },
});

export default App;