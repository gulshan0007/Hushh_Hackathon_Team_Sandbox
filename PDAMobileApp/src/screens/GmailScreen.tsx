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
  Linking,
  Clipboard,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { agentCommunication } from '../services/agent_communication';

// Define types for emails and insights
interface EmailItem {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  body?: string;  // Full email content
  hasAttachments?: boolean;
}

interface InsightData {
  summary: string;
  actionItems: string[];
  keyTopics: string[];
  priority: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Add new interfaces for AI features
interface CategoryData {
  categories: { [key: string]: number[] };
  priorities: { [key: string]: string };
  actions: { [key: string]: string };
  due_dates: { [key: string]: string };
  entities: { [key: string]: string[] };
}

interface MeetingSummary {
  key_points: string[];
  decisions: string[];
  action_items: string[];
  attendees: string[];
  next_steps: string[];
  follow_up_date?: string;
}

const { width, height } = Dimensions.get('window');
const BACKEND_URL = 'https://5ef39224041b.ngrok-free.app';

const GmailScreen = () => {
  // State variables
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('user_' + Date.now());
  const [consentTokenRead, setConsentTokenRead] = useState('');
  const [consentTokenWrite, setConsentTokenWrite] = useState('');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [proposalType, setProposalType] = useState<'summary' | 'proposal' | 'analysis'>('summary');
  const [generatedContent, setGeneratedContent] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmailDetails, setSelectedEmailDetails] = useState<EmailItem | null>(null);
  const [showSmartReplyModal, setShowSmartReplyModal] = useState(false);
  const [generatedReply, setGeneratedReply] = useState('');
  const [replyEmailDetails, setReplyEmailDetails] = useState<any>(null);
  const [replyStyle, setReplyStyle] = useState<'professional' | 'casual' | 'formal' | 'brief' | 'detailed'>('professional');
  const [generatingReply, setGeneratingReply] = useState(false);
  
  // Pagination states
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMoreEmails, setHasMoreEmails] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 5;
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  // Add new state variables
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [sentimentTrends, setSentimentTrends] = useState<any>(null);
  const [statusReport, setStatusReport] = useState<string>('');
  const [emailDigest, setEmailDigest] = useState<string>('');

  useEffect(() => {
    animateEntrance();
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

  const restoreTokens = async () => {
    try {
      const read = await AsyncStorage.getItem('gmail_consent_token_read');
      const write = await AsyncStorage.getItem('gmail_consent_token_write');
      const uid = await AsyncStorage.getItem('gmail_user_id');
      
      console.log('📧 Gmail tokens check:', {
        hasRead: !!read,
        hasWrite: !!write,
        hasUser: !!uid
      });
      
      if (read) setConsentTokenRead(read);
      if (write) setConsentTokenWrite(write);
      if (uid) setUserId(uid);
      
      // Auto-sync if connected (but delay to ensure state is updated)
      if (read && uid) {
        console.log('🔄 Auto-syncing Gmail...');
        setTimeout(async () => {
          try {
            // Use the tokens directly instead of relying on state
            console.log('📧 Fetching emails with restored tokens...');
            const testRes = await axios.get(`${BACKEND_URL}/inbox-agent/test-connection`, {
              params: { token: read, user_id: uid },
              timeout: 10000
            });
            console.log('✅ Connection test with restored tokens:', testRes.data);
            
            const emailRes = await axios.get(`${BACKEND_URL}/inbox-agent/emails`, {
              params: { token: read, user_id: uid, max_results: 5 },
              timeout: 10000
            });
            setEmails(emailRes.data.emails || []);
          } catch (error) {
            console.log('❌ Auto-sync error:', error);
          }
        }, 100); // Small delay to ensure state updates
      }
    } catch (error) {
      console.error('Error restoring Gmail tokens:', error);
    }
  };

  // Gmail OAuth Flow
  const startGmailAuth = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/inbox-agent/auth/gmail`, {
        params: { user_id: userId }
      });
      const { auth_url } = res.data;
      await Linking.openURL(auth_url);
    } catch (err: any) {
      console.log('Gmail auth error:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to start Gmail authentication');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth Callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      console.log('📱 Received URL:', url);
      
      if (url.startsWith('myapp://oauth-success') && url.includes('type=gmail')) {
        try {
          const params = new URLSearchParams(url.split('?')[1]);
          const tokenRead = params.get('consent_token_read') || '';
          const tokenWrite = params.get('consent_token_write') || '';
          const uid = params.get('user_id') || userId;
          
          console.log('🔑 Saving Gmail tokens:', {
            hasRead: !!tokenRead,
            hasWrite: !!tokenWrite,
            hasUser: !!uid
          });
          
          // Save to state
          setConsentTokenRead(tokenRead);
          setConsentTokenWrite(tokenWrite);
          setUserId(uid);
          
          // Save to AsyncStorage
          await AsyncStorage.setItem('gmail_consent_token_read', tokenRead);
          await AsyncStorage.setItem('gmail_consent_token_write', tokenWrite);
          await AsyncStorage.setItem('gmail_user_id', uid);
          
          console.log('✅ Gmail tokens saved successfully!');
          Alert.alert('🎉 Success', 'Gmail connected successfully!');
          
          // Auto-fetch emails and generate insights after a short delay
          setTimeout(async () => {
            try {
              await fetchEmails();
              console.log('🔄 Auto-generating insights after email fetch...');
              await generateInsights(true); // Skip loading indicator for smoother UX
            } catch (error) {
              console.error('Error auto-fetching:', error);
            }
          }, 1000);
          
        } catch (error) {
          console.error('Error handling Gmail callback:', error);
          Alert.alert('❌ Error', 'Failed to save Gmail credentials');
        }
      }
    };
    
    Linking.addEventListener('url', handleUrl);
    return () => Linking.removeAllListeners('url');
  }, [userId]);

  const fetchEmails = async (skipLoading = false, isLoadMore = false) => {
    try {
      if (!skipLoading) {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
      }
      
      // Debug: Check if we have tokens
      console.log('🔍 fetchEmails debug:', {
        consentTokenRead: consentTokenRead ? `${consentTokenRead.slice(0, 20)}...` : 'EMPTY',
        userId: userId,
        hasToken: !!consentTokenRead,
        isLoadMore,
        nextPageToken: isLoadMore ? nextPageToken : 'first_page'
      });
      
      if (!consentTokenRead || !userId) {
        console.log('❌ Missing tokens, aborting fetchEmails');
        throw new Error('Missing authentication tokens');
      }
      
      // First test connection (only for initial load)
      if (!isLoadMore) {
        console.log('🧪 Testing Gmail connection...');
        const testRes = await axios.get(`${BACKEND_URL}/inbox-agent/test-connection`, {
          params: {
            token: consentTokenRead,
            user_id: userId
          },
          timeout: 10000
        });
        console.log('✅ Connection test:', testRes.data);
      }
      
      // Calculate pagination parameters
      const pageTokenToUse = isLoadMore ? nextPageToken : null;
      const maxResults = PAGE_SIZE;
      
      // Then get emails
      console.log(`📧 Fetching emails${pageTokenToUse ? ' (next page)' : ' (first page)'}...`);
      const res = await axios.get(`${BACKEND_URL}/inbox-agent/emails`, {
        params: {
          token: consentTokenRead,
          user_id: userId,
          max_results: maxResults,
          ...(pageTokenToUse && { page_token: pageTokenToUse })  // Add page_token if available
        },
        timeout: 10000  // 10 second timeout
      });
      
      const newEmails = res.data.emails || [];
      const paginationInfo = res.data.pagination;
      
      console.log('📊 Pagination info:', paginationInfo);
      console.log('📧 New emails received:', newEmails.map((e: EmailItem) => ({ id: e.id.slice(0, 8), subject: e.subject.slice(0, 30) })));
      
      if (isLoadMore) {
        // Append new emails to existing ones, avoiding duplicates
        setEmails(prevEmails => {
          const existingIds = new Set(prevEmails.map(email => email.id));
          const uniqueNewEmails = newEmails.filter((email: EmailItem) => !existingIds.has(email.id));
          console.log(`📧 Adding ${uniqueNewEmails.length} new emails (${newEmails.length - uniqueNewEmails.length} duplicates filtered)`);
          return [...prevEmails, ...uniqueNewEmails];
        });
      } else {
        // Replace emails for fresh fetch
        setEmails(newEmails);
      }
      
      // Update pagination state with next page token
      setNextPageToken(paginationInfo?.next_page_token || null);
      setHasMoreEmails(paginationInfo?.has_more || false);
      
      // Auto-generate insights for fresh fetches (not for loading more)
      if (!isLoadMore && newEmails.length > 0) {
        console.log('🧠 Auto-generating insights for fresh email fetch...');
        setTimeout(() => {
          generateInsights(true); // Skip loading indicator for smoother UX
        }, 500); // Small delay to ensure UI is updated
      }
      
    } catch (err: any) {
      console.log('Error fetching emails:', err.response?.data || err.message);
      if (!isLoadMore) {
        Alert.alert('❌ Error', 'Failed to fetch emails');
      }
    } finally {
      if (!skipLoading) {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  };

  const generateInsights = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      
      if (!consentTokenRead || !userId) {
        console.log('❌ Missing tokens, aborting generateInsights');
        return;
      }
      
      const emailIds = selectedEmails.length > 0 ? selectedEmails : emails.slice(0, 10).map(e => e.id);
      
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/analyze`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds,
        analysis_type: 'comprehensive'
      });
      
      setInsights(res.data.insights);
    } catch (err: any) {
      console.log('Error generating insights:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to generate insights');
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  const generateContent = async () => {
    try {
      setLoading(true);
      
      if (!consentTokenRead || !userId) {
        Alert.alert('❌ Error', 'Please connect to Gmail first');
        return;
      }
      
      const emailIds = selectedEmails.length > 0 ? selectedEmails : emails.slice(0, 5).map(e => e.id);
      
      console.log('🔍 generateContent debug:', {
        tokenLength: consentTokenRead.length,
        tokenStart: consentTokenRead.slice(0, 20),
        userId: userId,
        emailCount: emailIds.length,
        proposalType: proposalType
      });
      
      const res = await axios.post(`${BACKEND_URL}/generate`, {
        token: consentTokenRead,  // Changed from consentTokenWrite to consentTokenRead
        user_id: userId,
        email_ids: emailIds,
        type: proposalType,
        custom_prompt: customPrompt || undefined
      });
      
      setGeneratedContent(res.data.content);
      setShowGenerateModal(false);
      
      Alert.alert('✅ Generated!', `Your ${proposalType} has been created successfully.`);
    } catch (err: any) {
      console.log('Error generating content:', err.response?.data || err.message);
      Alert.alert('❌ Error', 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const openEmailDetails = async (email: EmailItem) => {
    setSelectedEmailDetails(email);
    setShowEmailModal(true);
    
    // Clear previous insights to show fresh data for this email
    setInsights(null);
    
    // Auto-generate insights for this specific email and switch to insights tab
    if (consentTokenRead && userId) {
      console.log('🔍 Auto-generating insights for clicked email:', email.subject?.slice(0, 30));
      try {
        // Generate insights for just this email
        const res = await axios.post(`${BACKEND_URL}/inbox-agent/analyze`, {
          token: consentTokenRead,
          user_id: userId,
          email_ids: [email.id],
          analysis_type: 'comprehensive'
        });
        
        // Store the insights
        setInsights(res.data.insights);
        
        // Automatically switch to insights tab after a brief delay
        setTimeout(() => {
          setActiveTab('insights');
        }, 500);
        
        console.log('📊 Auto insights generated and insights tab activated for email');
      } catch (error) {
        console.log('❌ Auto insights generation failed:', error);
        // Still switch to insights tab even if generation fails
        setTimeout(() => {
          setActiveTab('insights');
        }, 500);
      }
    }
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setSelectedEmailDetails(null);
  };

  const openGmailWithReply = (emailDetails: any, replyText: string) => {
    try {
      // Prepare Gmail compose URL with pre-filled content
      const subject = emailDetails.subject.startsWith('Re:') 
        ? emailDetails.subject 
        : `Re: ${emailDetails.subject}`;
      
      // Extract email address from "Name <email>" format
      const fromMatch = emailDetails.from.match(/<(.+?)>/);
      const toEmail = fromMatch ? fromMatch[1] : emailDetails.from;
      
      const body = `${replyText}\n\n---\nOriginal Message:\nFrom: ${emailDetails.from}\nSubject: ${emailDetails.subject}\n\n${emailDetails.snippet}`;
      
      // Create Gmail compose URL
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Try Gmail app first, then fallback to browser
      const gmailAppUrl = `googlegmail://co?to=${encodeURIComponent(toEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Try Gmail app first
      Linking.canOpenURL(gmailAppUrl)
        .then(supported => {
          if (supported) {
            return Linking.openURL(gmailAppUrl);
          } else {
            // Fallback to web Gmail
            return Linking.openURL(gmailUrl);
          }
        })
        .catch(err => {
          console.error('Failed to open Gmail:', err);
          // Last resort: try web Gmail directly
          Linking.openURL(gmailUrl).catch(() => {
            Alert.alert('Error', 'Failed to open Gmail. Please check if you have Gmail app or browser available.');
          });
        });
      
      // Close the smart reply modal
      setShowSmartReplyModal(false);
    } catch (error) {
      console.error('Error opening Gmail:', error);
      Alert.alert('Error', 'Failed to prepare Gmail reply');
    }
  };

  const logout = async () => {
    Alert.alert(
      '🚪 Logout',
      'Are you sure you want to disconnect your Gmail?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            setConsentTokenRead('');
            setConsentTokenWrite('');
            setEmails([]);
            setInsights(null);
            setGeneratedContent('');
            setSelectedEmails([]);
            
            await AsyncStorage.removeItem('gmail_consent_token_read');
            await AsyncStorage.removeItem('gmail_consent_token_write');
            await AsyncStorage.removeItem('gmail_user_id');
            
            Alert.alert('✅ Disconnected', 'Your Gmail has been disconnected successfully.');
          }
        }
      ]
    );
  };

  const loadMoreEmails = async () => {
    if (!hasMoreEmails || loadingMore) {
      console.log('❌ Cannot load more:', { hasMoreEmails, loadingMore });
      return;
    }
    
    console.log('📧 Loading more emails...');
    await fetchEmails(false, true);  // isLoadMore = true
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setLoading(false);
    setNextPageToken(null);
    setHasMoreEmails(true);
    
    try {
      if (consentTokenRead && userId) {
        await Promise.all([
          fetchEmails(true),
          generateInsights(true)
        ]);
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [consentTokenRead, userId, selectedEmails]);

  // Add new AI feature functions
  const categorizeEmails = async (emailIds: string[]) => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/categorize`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds
      });
      setCategories(res.data.categories);
    } catch (error) {
      console.error('Error categorizing emails:', error);
      Alert.alert('Error', 'Failed to categorize emails');
    } finally {
      setLoading(false);
    }
  };

  const generateMeetingSummary = async (emailId: string) => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/meeting-summary`, {
        token: consentTokenRead,
        user_id: userId,
        email_id: emailId
      });
      setMeetingSummary(res.data.summary);
    } catch (error) {
      console.error('Error generating meeting summary:', error);
      Alert.alert('Error', 'Failed to generate meeting summary');
    } finally {
      setLoading(false);
    }
  };

  const extractActionItems = async (emailIds: string[]) => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/action-items`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds
      });
      setActionItems(res.data.actions);
    } catch (error) {
      console.error('Error extracting action items:', error);
      Alert.alert('Error', 'Failed to extract action items');
    } finally {
      setLoading(false);
    }
  };

  const analyzeSentiment = async (emailIds: string[], timeframe: string = '1w') => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/sentiment-analysis`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds,
        timeframe
      });
      setSentimentTrends(res.data.analysis);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      Alert.alert('Error', 'Failed to analyze sentiment');
    } finally {
      setLoading(false);
    }
  };

  const generateStatusReport = async (emailIds: string[], reportType: string = 'weekly') => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/status-report`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds,
        report_type: reportType
      });
      setStatusReport(res.data.report);
    } catch (error) {
      console.error('Error generating status report:', error);
      Alert.alert('Error', 'Failed to generate status report');
    } finally {
      setLoading(false);
    }
  };

  const createEmailDigest = async (emailIds: string[], format: string = 'brief') => {
    try {
      setLoading(true);
      const res = await axios.post(`${BACKEND_URL}/inbox-agent/email-digest`, {
        token: consentTokenRead,
        user_id: userId,
        email_ids: emailIds,
        format
      });
      setEmailDigest(res.data.digest);
    } catch (error) {
      console.error('Error creating email digest:', error);
      Alert.alert('Error', 'Failed to create email digest');
    } finally {
      setLoading(false);
    }
  };

  const renderConnectionStatus = () => (
    <View style={styles.connectionCard}>
      {!consentTokenRead ? (
        <View>
          <View style={styles.connectionHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.connectionTitle}>📧 Connect Gmail</Text>
          </View>
          <Text style={styles.connectionSubtitle}>
            Connect your Gmail to enable AI-powered inbox insights and document analysis
          </Text>
          <TouchableOpacity style={styles.connectButton} onPress={startGmailAuth}>
            <Text style={styles.connectButtonText}>Connect Gmail Account</Text>
          </TouchableOpacity>
          
          {/* Debug Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>User ID: {userId}</Text>
            <Text style={styles.debugText}>
              Backend: {BACKEND_URL.replace('https://', '')}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.connectedHeader}>
          <View style={styles.connectionInfo}>
            <View style={[styles.statusIndicator, { backgroundColor: '#4CAF50' }]} />
            <View>
              <Text style={styles.connectionTitle}>📧 Connected</Text>
              <Text style={styles.connectionSubtitle}>
                Auto-analyzing your inbox with AI
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
        { key: 'inbox', title: '📥 Inbox', icon: '📥' },
        { key: 'insights', title: '🧠 Insights', icon: '🧠' },
        { key: 'generated', title: '✨ Generated', icon: '✨' }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={async () => {
            setActiveTab(tab.key);
            
            // Clear email context when manually switching away from insights
            if (tab.key !== 'insights' && selectedEmailDetails) {
              setSelectedEmailDetails(null);
            }
            
            // Auto-generate insights when switching to insights tab if not available
            if (tab.key === 'insights' && !insights && emails.length > 0 && consentTokenRead) {
              console.log('🧠 Auto-generating insights for insights tab...');
              setTimeout(() => {
                generateInsights(true); // Skip loading indicator for smoother UX
              }, 200);
            }
          }}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.icon}
          </Text>
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.title.replace(/📥|🧠|✨\s/, '')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderInbox = () => (
    <View style={styles.tabContent}>
      <View style={styles.inboxHeader}>
        <Text style={styles.sectionTitle}>📥 Inbox</Text>
        {emails.length > 0 && (
          <Text style={styles.selectionCount}>
            {selectedEmails.length} selected
          </Text>
        )}
      </View>
      
      {emails.length > 0 ? (
        <View style={styles.emailList}>
          {emails.map((email, index) => (
            <TouchableOpacity
              key={`${email.id}-${index}`}
              style={[
                styles.gmailEmailCard,
                selectedEmails.includes(email.id) && styles.gmailEmailCardSelected,
                index === 0 && styles.firstEmailCard,
                index === emails.length - 1 && styles.lastEmailCard
              ]}
              onPress={() => openEmailDetails(email)}
              onLongPress={() => toggleEmailSelection(email.id)}
              activeOpacity={0.7}
            >
              <View style={styles.gmailEmailContent}>
                {/* Avatar */}
                <View style={[
                  styles.avatar, 
                  { backgroundColor: getAvatarColor(email.from) }
                ]}>
                  <Text style={styles.avatarText}>
                    {getInitials(email.from)}
                  </Text>
                </View>

                {/* Email Content */}
                <View style={styles.gmailEmailBody}>
                  <View style={styles.gmailEmailHeader}>
                    <View style={styles.gmailEmailSender}>
                      <Text style={styles.gmailSenderName} numberOfLines={1}>
                        {email.from.split('<')[0].trim() || email.from}
                      </Text>
                      {email.hasAttachments && (
                        <Text style={styles.gmailAttachmentIcon}>📎</Text>
                      )}
                    </View>
                    <Text style={styles.gmailEmailDate}>
                      {formatDate(email.date)}
                    </Text>
                  </View>
                  
                  <Text style={styles.gmailEmailSubject} numberOfLines={1}>
                    {email.subject || '(No subject)'}
                  </Text>
                  
                  <Text style={styles.gmailEmailSnippet} numberOfLines={2}>
                    {email.snippet}
                  </Text>
                </View>

                {/* Selection Indicator */}
                {selectedEmails.includes(email.id) && (
                  <View style={styles.gmailSelectionIndicator}>
                    <Text style={styles.gmailSelectedIcon}>✓</Text>
                  </View>
                )}
              </View>

              {/* Unread Indicator */}
              {index < 2 && (
                <View style={styles.unreadIndicator} />
              )}
            </TouchableOpacity>
          ))}
          
          {/* Load More Button */}
          {hasMoreEmails && (
            <View style={styles.loadMoreContainer}>
              <TouchableOpacity 
                style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
                onPress={loadMoreEmails}
                disabled={loadingMore}
                activeOpacity={0.7}
              >
                <Text style={[styles.loadMoreButtonText, loadingMore && styles.loadMoreButtonTextDisabled]}>
                  {loadingMore ? '⏳ Loading...' : '📧 Load More Emails'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Email count indicator */}
          {emails.length > 0 && (
            <View style={styles.emailCountContainer}>
              <Text style={styles.emailCountText}>
                Showing {emails.length} email{emails.length !== 1 ? 's' : ''}
                {!hasMoreEmails && ' (all loaded)'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📭</Text>
          <Text style={styles.emptyStateText}>No emails found</Text>
          <Text style={styles.emptyStateSubtext}>
            Connect your Gmail to start analyzing your inbox
          </Text>
        </View>
      )}
    </View>
  );

  const renderInsights = () => (
    <View style={styles.tabContent}>
      {loading && !insights && (
        <View style={styles.insightCard}>
          <View style={styles.insightGeneratingContainer}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.insightGeneratingText}>🧠 Generating AI insights...</Text>
          </View>
        </View>
      )}
      
      {insights ? (
        <>
          {/* Show email context if insights are for a specific email */}
          {selectedEmailDetails && (
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>📧 Insights for Email:</Text>
              <Text style={styles.insightContent}>"{selectedEmailDetails.subject}"</Text>
              <Text style={styles.actionItem}>From: {selectedEmailDetails.from}</Text>
            </View>
          )}
          
          <View style={styles.insightCard}>
            <View style={styles.insightHeaderRow}>
              <Text style={styles.insightTitle}>
                {selectedEmailDetails ? '📊 Email Analysis' : '📊 Inbox Summary'}
              </Text>
              <Text style={styles.insightAutoLabel}>✨ Auto-generated</Text>
            </View>
            <Text style={styles.insightContent}>{insights.summary}</Text>
          </View>
          
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>✅ Action Items</Text>
            {insights.actionItems.map((item, index) => (
              <Text key={index} style={styles.actionItem}>
                • {item}
              </Text>
            ))}
          </View>
          
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>🏷️ Key Topics</Text>
            <View style={styles.topicsContainer}>
              {insights.keyTopics.map((topic, index) => (
                <View key={index} style={styles.topicTag}>
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
          
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>📈 Analysis</Text>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Priority:</Text>
              <View style={[styles.priorityBadge, { backgroundColor: 
                insights.priority === 'high' ? '#FEE2E2' : 
                insights.priority === 'medium' ? '#FEF3C7' : '#F0FDF4' 
              }]}>
                <Text style={[styles.priorityText, { color: 
                  insights.priority === 'high' ? '#DC2626' : 
                  insights.priority === 'medium' ? '#D97706' : '#16A34A' 
                }]}>
                  {insights.priority.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Sentiment:</Text>
              <Text style={styles.sentimentText}>
                {insights.sentiment === 'positive' ? '😊 Positive' :
                 insights.sentiment === 'negative' ? '😟 Negative' : '😐 Neutral'}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🧠</Text>
          <Text style={styles.emptyStateText}>AI Insights</Text>
          <Text style={styles.emptyStateSubtext}>
            {emails.length > 0 
              ? "Insights will generate automatically when you have emails"
              : "Connect Gmail and fetch emails to see AI-powered insights"
            }
          </Text>
          {emails.length > 0 && !loading && (
            <TouchableOpacity 
              style={styles.generateButton}
              onPress={() => generateInsights()}
            >
              <Text style={styles.generateButtonText}>Generate Insights Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderGenerated = () => (
    <View style={styles.tabContent}>
      {generatedContent ? (
        <ScrollView 
          style={styles.generatedScrollContainer}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <View style={styles.generatedCard}>
            <Text style={styles.generatedTitle}>✨ Generated Content</Text>
            <View style={styles.generatedContentContainer}>
              <ScrollView 
                style={styles.generatedContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <Text style={styles.generatedText}>{generatedContent}</Text>
              </ScrollView>
            </View>
            <TouchableOpacity 
              style={styles.regenerateButton}
              onPress={() => setShowGenerateModal(true)}
            >
              <Text style={styles.regenerateButtonText}>Generate New Content</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No generated content</Text>
          <Text style={styles.emptyStateSubtext}>
            Use AI to create summaries, proposals, and insights
          </Text>
          <TouchableOpacity 
            style={styles.generateButton}
            onPress={() => setShowGenerateModal(true)}
          >
            <Text style={styles.generateButtonText}>Generate Content</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderGenerateModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showGenerateModal}
      onRequestClose={() => setShowGenerateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✨ Generate Content</Text>
            <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Content Type</Text>
            <View style={styles.typeButtons}>
              {[
                { key: 'summary', label: '📄 Summary' },
                { key: 'proposal', label: '📋 Proposal' },
                { key: 'analysis', label: '📊 Analysis' }
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeButton,
                    proposalType === type.key && styles.typeButtonActive
                  ]}
                  onPress={() => setProposalType(type.key as any)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    proposalType === type.key && styles.typeButtonTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Custom Instructions (Optional)</Text>
            <TextInput
              style={styles.formTextArea}
              placeholder="Add specific instructions for AI generation..."
              value={customPrompt}
              onChangeText={setCustomPrompt}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowGenerateModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.generateActionButton} 
              onPress={generateContent}
              disabled={loading}
            >
              <Text style={styles.generateActionButtonText}>
                {loading ? 'Generating...' : 'Generate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const emailModalActions = (
    <View style={styles.emailModalActions}>
      {/* Temporarily commented out - Add to Calendar functionality 
      <TouchableOpacity 
        style={styles.emailModalActionButton}
        onPress={async () => {
          try {
            // Generate meeting summary if it looks like a meeting email
            if (selectedEmailDetails?.subject?.toLowerCase().includes('meeting') ||
                selectedEmailDetails?.subject?.toLowerCase().includes('call')) {
              await generateMeetingSummary(selectedEmailDetails.id);
            }
            
            // Extract potential event details
            const eventDetails = {
              summary: selectedEmailDetails?.subject,
              description: selectedEmailDetails?.body,
              // Add other event details as needed
            };
            
            // Create calendar event
            await agentCommunication.createEventFromEmail(
              selectedEmailDetails?.id || '',
              eventDetails
            );
            
            Alert.alert('Success', 'Calendar event created from email');
          } catch (error) {
            console.error('Error processing email:', error);
            Alert.alert('Error', 'Failed to process email');
          }
          closeEmailModal();
        }}
      >
        <Text style={styles.emailModalActionText}>📅 Add to Calendar</Text>
      </TouchableOpacity>
      */}
      
      {/* <TouchableOpacity 
        style={[styles.emailModalActionButton, { backgroundColor: '#4F46E5' }]}
        onPress={async () => {
          try {
            // Extract action items
            await extractActionItems([selectedEmailDetails?.id || '']);
            
            // Set reminder if action items found
            if (actionItems.length > 0) {
              const reminderDetails = {
                action_items: actionItems,
                due_date: actionItems[0].due_date
              };
              
              await agentCommunication.setEmailReminder(
                selectedEmailDetails?.id || '',
                reminderDetails
              );
            }
            
            Alert.alert('Success', 'Action items extracted and reminder set');
          } catch (error) {
            console.error('Error processing action items:', error);
            Alert.alert('Error', 'Failed to process action items');
          }
          closeEmailModal();
        }}
      >
        <Text style={styles.emailModalActionText}>✅ Extract Actions</Text>
      </TouchableOpacity> */}
      
      <TouchableOpacity 
        style={[styles.emailModalActionButton, { backgroundColor: '#059669' }]}
        onPress={async () => {
          try {
            setGeneratingReply(true);
            setReplyEmailDetails(selectedEmailDetails);
            setShowSmartReplyModal(true);
            
            // Generate smart reply with selected style
            console.log('🤖 Generating smart reply with style:', replyStyle);
            const reply = await agentCommunication.generateSmartReply(
              selectedEmailDetails?.id || '', 
              replyStyle
            );
            
            // Show the complete reply
            setGeneratedReply(reply);
            console.log('✅ Smart reply generated, length:', reply.length, 'characters');
          } catch (error) {
            console.error('Error generating reply:', error);
            Alert.alert('❌ Error', 'Failed to generate smart reply. Please try again.');
            setShowSmartReplyModal(false);
          } finally {
            setGeneratingReply(false);
          }
        }}
        disabled={generatingReply}
      >
        <Text style={styles.emailModalActionText}>
          {generatingReply ? '🔄 Generating...' : '💬 Smart Reply'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmailModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEmailModal}
      onRequestClose={closeEmailModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.emailModalContent}>
          {selectedEmailDetails && (
            <>
              {/* Header */}
              <View style={styles.emailModalHeader}>
                <TouchableOpacity 
                  style={styles.emailModalBackButton}
                  onPress={closeEmailModal}
                >
                  <Text style={styles.emailModalBackText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => toggleEmailSelection(selectedEmailDetails.id)}
                >
                  <Text style={styles.emailModalSelectText}>
                    {selectedEmails.includes(selectedEmailDetails.id) ? '✓ Selected' : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Subject */}
              <View style={styles.emailModalSubjectContainer}>
                <Text style={styles.emailModalSubject}>
                  {selectedEmailDetails.subject || '(No subject)'}
                </Text>
                {selectedEmailDetails.hasAttachments && (
                  <Text style={styles.emailModalAttachment}>📎 Attachment</Text>
                )}
              </View>

              {/* Sender Info */}
              <View style={styles.emailModalSenderContainer}>
                <View style={[
                  styles.emailModalAvatar, 
                  { backgroundColor: getAvatarColor(selectedEmailDetails.from) }
                ]}>
                  <Text style={styles.emailModalAvatarText}>
                    {getInitials(selectedEmailDetails.from)}
                  </Text>
                </View>
                <View style={styles.emailModalSenderInfo}>
                  <Text style={styles.emailModalSenderName}>
                    {selectedEmailDetails.from.split('<')[0].trim() || selectedEmailDetails.from.split('@')[0]}
                  </Text>
                  <Text style={styles.emailModalSenderEmail}>
                    {selectedEmailDetails.from.includes('<') 
                      ? selectedEmailDetails.from.match(/<(.+)>/)?.[1] || selectedEmailDetails.from
                      : selectedEmailDetails.from
                    }
                  </Text>
                  <Text style={styles.emailModalDate}>
                    {new Date(selectedEmailDetails.date).toLocaleString() !== 'Invalid Date' 
                      ? new Date(selectedEmailDetails.date).toLocaleString()
                      : selectedEmailDetails.date
                    }
                  </Text>
                </View>
              </View>

              {/* Email Content */}
              <View style={styles.emailModalContentContainer}>
                <Text style={styles.emailModalContentTitle}>Message:</Text>
                <ScrollView 
                  style={styles.emailModalContentScroll}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <Text style={styles.emailModalContentText}>
                    {selectedEmailDetails.body && selectedEmailDetails.body.trim() !== '' 
                      ? selectedEmailDetails.body 
                      : selectedEmailDetails.snippet && selectedEmailDetails.snippet.trim() !== ''
                        ? selectedEmailDetails.snippet
                        : 'No email content available. This might be a notification or system email.'
                    }
                  </Text>
                  
                  {/* Debug info for development */}
                  {__DEV__ && (
                    <View style={styles.debugInfo}>
                      <Text style={styles.debugText}>
                        Debug: Body length: {selectedEmailDetails.body?.length || 0}, 
                        Snippet length: {selectedEmailDetails.snippet?.length || 0}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>

              {/* Add meeting summary if available */}
              {meetingSummary && (
                <View style={styles.meetingSummaryContainer}>
                  <Text style={styles.meetingSummaryTitle}>📅 Meeting Summary</Text>
                  <View style={styles.meetingSummaryContent}>
                    {meetingSummary.key_points.map((point, index) => (
                      <Text key={index} style={styles.meetingSummaryPoint}>• {point}</Text>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Add action items if available */}
              {actionItems.length > 0 && (
                <View style={styles.actionItemsContainer}>
                  <Text style={styles.actionItemsTitle}>✅ Action Items</Text>
                  <View style={styles.actionItemsList}>
                    {actionItems.map((item, index) => (
                      <View key={index} style={styles.actionItemCardModal}>
                        <Text style={styles.actionItemText}>{item.description}</Text>
                        {item.due_date && (
                          <Text style={styles.actionItemDue}>Due: {item.due_date}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Add enhanced action buttons */}
              {emailModalActions}
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderSmartReplyModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showSmartReplyModal}
      onRequestClose={() => setShowSmartReplyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.simpleSmartReplyModal}>
          {/* Simple Header */}
          <View style={styles.simpleModalHeader}>
            <Text style={styles.simpleModalTitle}>
              {generatingReply ? '🤖 Generating Reply...' : '💬 Smart Reply'}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowSmartReplyModal(false);
                setGeneratedReply('');
                setGeneratingReply(false);
              }}
              style={styles.simpleCloseButton}
            >
              <Text style={styles.simpleCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Email Context - Simple */}
          {replyEmailDetails && (
            <View style={styles.simpleEmailContext}>
              <Text style={styles.simpleEmailSubject} numberOfLines={1}>
                {replyEmailDetails.subject}
              </Text>
              <Text style={styles.simpleEmailFrom} numberOfLines={1}>
                From: {replyEmailDetails.from}
              </Text>
            </View>
          )}

          {/* Style Selector - Simplified */}
          <View style={styles.simpleStyleContainer}>
            <Text style={styles.simpleStyleTitle}>Style:</Text>
            <View style={styles.simpleStyleButtons}>
              {(['professional', 'casual', 'formal', 'brief', 'detailed'] as const).map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.simpleStyleButton,
                    replyStyle === style && styles.simpleStyleButtonActive
                  ]}
                  onPress={async () => {
                    if (!generatingReply && replyEmailDetails) {
                      setReplyStyle(style);
                      setGeneratingReply(true);
                      setGeneratedReply('');
                      
                      try {
                        console.log('🎨 Generating reply with style:', style);
                        const reply = await agentCommunication.generateSmartReply(
                          replyEmailDetails.id, 
                          style
                        );
                        setGeneratedReply(reply);
                        console.log('✅ Reply generated:', reply.length, 'characters');
                      } catch (error) {
                        console.error('Error generating reply:', error);
                        Alert.alert('❌ Error', 'Failed to generate reply. Please try again.');
                      } finally {
                        setGeneratingReply(false);
                      }
                    }
                  }}
                  disabled={generatingReply}
                >
                  <Text style={[
                    styles.simpleStyleButtonText,
                    replyStyle === style && styles.simpleStyleButtonTextActive
                  ]}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Scrollable Content Area */}
          <View style={styles.simpleContentArea}>
            {generatingReply ? (
              <View style={styles.simpleLoadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.simpleLoadingText}>
                  Generating {replyStyle} reply...
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.simpleReplyScrollView}
                contentContainerStyle={styles.simpleReplyScrollContent}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.simpleReplyContent}>
                  <Text style={styles.simpleReplyText} selectable={true}>
                    {generatedReply || 'Select a style above to generate a smart reply.'}
                  </Text>
                  {generatedReply && (
                    <Text style={styles.simpleReplyStats}>
                      {generatedReply.length} characters • {generatedReply.split(' ').length} words
                    </Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Action Buttons - Fixed at bottom */}

{!generatingReply && generatedReply && (
  <View style={styles.simpleActionButtonsContainer}>
    <TouchableOpacity 
      style={styles.simpleActionButton}
      onPress={() => {
        Alert.alert(
          '📋 Complete Reply', 
          generatedReply,
          [
            { 
              text: 'Copy Text to Clipboard',
              onPress: () => {
                Clipboard.setString(generatedReply);
                // Optional: Show a toast or brief confirmation
                Alert.alert('Copied!', 'Text copied to clipboard');
              }
            }
          ],
          { cancelable: true }
        );
      }}
    >
      <Text style={styles.simpleActionButtonText}>📋 Show Reply</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.simpleActionButton, styles.simplePrimaryButton]}
      onPress={() => {
        if (replyEmailDetails) {
          openGmailWithReply(replyEmailDetails, generatedReply);
        }
      }}
    >
      <Text style={styles.simplePrimaryButtonText}>📧 Reply in Gmail</Text>
    </TouchableOpacity>
  </View>
)}
        </View>
      </View>
    </Modal>
  );

  // Add new UI components for rendering AI features
  const renderCategories = () => (
    categories && (
      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>�� Categories</Text>
        {Object.entries(categories.categories).map(([category, emails]) => (
          <View key={category} style={styles.categoryItem}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <Text style={styles.categoryCount}>{emails.length} emails</Text>
          </View>
        ))}
      </View>
    )
  );

  const renderMeetingSummary = () => (
    meetingSummary && (
      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>📅 Meeting Summary</Text>
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Key Points:</Text>
          {meetingSummary.key_points.map((point, index) => (
            <Text key={index} style={styles.summaryPoint}>• {point}</Text>
          ))}
        </View>
        {/* Add other meeting summary sections */}
      </View>
    )
  );

  const renderActionItems = () => (
    actionItems.length > 0 && (
      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>✅ Action Items</Text>
        {actionItems.map((item, index) => (
          <View key={index} style={styles.actionItemCard}>
            <Text style={styles.actionItemCardTitle}>{item.description}</Text>
            <Text style={styles.actionItemDue}>Due: {item.due_date || 'Not specified'}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: 
              item.priority === 'high' ? '#FEE2E2' :
              item.priority === 'medium' ? '#FEF3C7' : '#F0FDF4'
            }]}>
              <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
            </View>
          </View>
        ))}
      </View>
    )
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
          <Text style={styles.headerTitle}>📧 Inbox to Insight Agent</Text>
          <Text style={styles.headerSubtitle}>AI-powered email analysis and content generation</Text>
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
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {activeTab === 'inbox' && renderInbox()}
          {activeTab === 'insights' && renderInsights()}
          {activeTab === 'generated' && renderGenerated()}
        </ScrollView>

        {/* Floating Action Button */}
        {consentTokenRead && emails.length > 0 && (
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => setShowGenerateModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>✨</Text>
          </TouchableOpacity>
        )}

        {renderGenerateModal()}
        {renderEmailModal()}
        {renderSmartReplyModal()}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
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
  connectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
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
  logoutButtonSimple: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 20,
    marginBottom: 20,
  },
  logoutButtonSimpleText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
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
    paddingHorizontal: 10,
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
  inboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  selectionCount: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  emailCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emailCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#F0F9FF',
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emailInfo: {
    flex: 1,
    marginRight: 12,
  },
  emailSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  emailFrom: {
    fontSize: 14,
    color: '#6B7280',
  },
  emailMeta: {
    alignItems: 'flex-end',
  },
  emailDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  attachmentIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  selectedIcon: {
    fontSize: 16,
    color: '#6366F1',
  },
  emailSnippet: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  insightCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  insightContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  actionItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  topicText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
    minWidth: 80,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sentimentText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  generatedCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  generatedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  generatedScrollContainer: {
    flex: 1,
  },
  generatedContentContainer: {
    flex: 1,
    marginBottom: 16,
    minHeight: 200,
    maxHeight: height * 0.6, // Use 60% of screen height
  },
  generatedContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  generatedText: {
    fontSize: 18,
    color: '#374151',
    lineHeight: 28,
    textAlign: 'left',
    fontWeight: '400',
  },
  regenerateButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  regenerateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
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
    fontSize: 20,
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
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#6366F1',
  },
  formTextArea: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
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
  generateActionButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateActionButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  
  // Gmail-like email styles
  emailList: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gmailEmailCard: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  gmailEmailCardSelected: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  firstEmailCard: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  lastEmailCard: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  gmailEmailContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  gmailEmailBody: {
    flex: 1,
    marginRight: 8,
  },
  gmailEmailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gmailEmailSender: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gmailSenderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  gmailAttachmentIcon: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  gmailEmailDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  gmailEmailSubject: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  gmailEmailSnippet: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  gmailSelectionIndicator: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gmailSelectedIcon: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#3B82F6',
  },
  emptyStateIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  // Email Modal Styles
  emailModalContent: {
    backgroundColor: 'white',
    marginHorizontal: 2,
    marginTop: height * 0.1,
    borderRadius: 16,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  emailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  emailModalBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  emailModalBackText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  emailModalSelectText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  emailModalSubjectContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  emailModalSubject: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 28,
  },
  emailModalAttachment: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  emailModalSenderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  emailModalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emailModalAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  emailModalSenderInfo: {
    flex: 1,
  },
  emailModalSenderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  emailModalSenderEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  emailModalDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emailModalContentContainer: {
    flex: 1,
    padding: 10,
  },
  emailModalContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  emailModalContentScroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  emailModalContentText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    textAlign: 'left',
  },
  emailModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  emailModalActionButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  emailModalSecondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  emailModalActionText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  emailModalSecondaryText: {
    color: '#6B7280',
  },
  meetingSummaryContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
  },
  meetingSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  meetingSummaryContent: {
    marginTop: 8,
  },
  meetingSummaryPoint: {
    fontSize: 14,
    color: '#0C4A6E',
    marginBottom: 4,
    lineHeight: 20,
  },
  actionItemsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
  },
  actionItemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  actionItemsList: {
    marginTop: 8,
  },
  actionItemCardModal: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  actionItemText: {
    fontSize: 14,
    color: '#065F46',
    marginBottom: 4,
  },
  actionItemDue: {
    fontSize: 12,
    color: '#047857',
    fontStyle: 'italic',
  },
  loadMoreContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadMoreButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  loadMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  loadMoreButtonTextDisabled: {
    color: '#E5E7EB',
  },
  emailCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  emailCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Category Styles
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Summary Styles
  summarySection: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  summaryPoint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    paddingLeft: 16,
  },

  // Action Item Card Styles
  actionItemCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionItemCardTitle: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 4,
  },

  // New styles for improved insights UX
  insightGeneratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  insightGeneratingText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '500',
    marginLeft: 12,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightAutoLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // Smart Reply Modal Styles - Enhanced
  simpleSmartReplyModal: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 0,
    marginHorizontal: 16,
    maxHeight: '92%',
    width: '92%', // Add explicit width constraint
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  simpleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFBFC',
  },
  simpleModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flexShrink: 1,
  },
  simpleCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  simpleCloseText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  simpleEmailContext: {
    backgroundColor: '#EEF2FF',
    marginHorizontal: 24,
    marginTop: 2,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  simpleEmailSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 22,
  },
  simpleEmailFrom: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  simpleStyleContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  simpleStyleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    marginTop: 4,
  },
  simpleStyleButtons: {
    flexDirection: 'row',
    paddingVertical: 4,
    flexWrap: 'wrap', // Allow buttons to wrap to next line if needed
    gap: 8,
  },
  simpleStyleButton: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 8,
  },
  simpleStyleButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  simpleStyleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  simpleStyleButtonTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  simpleReplyContainer: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  simpleReplyContent: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  simpleReplyText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1F2937',
    textAlign: 'left',
    fontWeight: '400',
    flex: 1,
    textAlignVertical: 'top',
  },
  simpleActionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  simpleActionButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  simplePrimaryButton: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  simplePrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  simpleLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    backgroundColor: '#FAFBFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 220,
  },
  simpleLoadingText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 22,
    fontWeight: '500',
  },
  simpleReplyStats: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontWeight: '500',
    marginTop: 8,
  },
  simpleActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  emailContextCard: {
    backgroundColor: '#EEF2FF',
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  emailContextTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailContextSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 22,
  },
  emailContextFrom: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  simpleReplyScrollView: {
    flex: 1,
  },
  simpleReplyScrollContent: {
    padding: 16,
  },

});

export default GmailScreen;