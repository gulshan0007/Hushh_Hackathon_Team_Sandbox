## 🚩 Implemented Agents & Hackathon Compliance

This repository includes two Personal Data Agents (PDAs) built for the Hushh PDA Hackathon, each demonstrating cryptographic consent, privacy, and modularity:

### 🗓️ `schedule_agent`
- **Purpose:** Smart calendar management with AI-powered scheduling, pattern learning, conflict detection, and consent-native privacy.
- **Consent Scopes:** `calendar.read`, `calendar.write`
- **Features:**
  - AI-powered time suggestions based on user patterns
  - Automatic conflict detection and avoidance
  - Learning user scheduling preferences (hours, days, durations)
  - Smart event creation with confidence scoring
  - Encrypted Google OAuth token storage
  - Consent validation on every API call
  - Mobile-first React Native interface
  - Real-time calendar synchronization

### 📥 `inbox_agent`
- **Purpose:** AI-powered email intelligence—turns Gmail inbox into actionable insights with consent-native AI analysis.
- **Consent Scopes:** `gmail.read`, `gmail.write`, `AI_ANALYZE`, `DOCUMENT_PROCESS`
- **Features:**
  - Gmail OAuth2 Integration
  - AI-powered email analysis and content generation
  - Inbox summarization, action item extraction, sentiment analysis
  - Professional proposal and response generation
  - Consent-native, privacy-preserving operations
  - Mobile-optimized, real-time insights

---

### ✅ Hackathon Requirements Compliance

- **Consent-Native:** Every agent action is gated by cryptographically signed, scope-limited consent tokens. No action is performed without explicit user permission.
- **Privacy-Preserving:** All sensitive data (e.g., OAuth tokens) is encrypted using AES-256-GCM. No plaintext credential storage.
- **Modular & Extensible:** Agents are implemented as independent modules with clear manifests, making it easy to extend or add new agents.
- **Testable & Auditable:** Comprehensive test suite covers consent, trust, vault, and agent workflows.
- **Mobile-First:** The `schedule_agent` is integrated with a React Native app for real-world, mobile consent flows.

---

## 📱 React Native App: PDAMobileApp

A full-featured React Native app serves as the frontend for both the schedule agent and inbox agent, demonstrating real-world mobile consent flows, AI-powered scheduling, and AI-powered email intelligence.

### 🗓️ CalendarScreen (AI Calendar Assistant)

- **Google Calendar Integration:**
  - OAuth2 flow for secure Google Calendar connection.
  - Consent tokens are stored and used for all backend operations.
- **Event Management:**
  - View, create, and manage both local and Google Calendar events.
  - Floating action button for quick event creation.
  - Smart/Manual toggle:
    - **Smart:** AI finds optimal time based on your patterns.
    - **Manual:** User selects date and time.
  - Add events for yourself or invite others (with Gmail address).
- **AI Features:**
  - **AI-powered suggestions:**
    - Suggests optimal meeting times based on learned user patterns.
    - Displays learned preferences (most common hour, preferred day, average duration).
    - "Suggest Time" button for instant AI recommendation.
  - **Pattern Learning:**
    - Fetches and displays analytics on your meeting habits.
    - Shows stats: total events, free slots, busy periods.
  - **Smart Event Creation:**
    - AI can auto-schedule events with confidence scoring and reasoning.
    - Displays AI suggestion card after smart scheduling.
- **UI/UX:**
  - Animated entrance, tabbed navigation (Overview, Events, Free Time).
  - Pull-to-refresh for real-time sync.
  - Custom date/time pickers, modals for event creation.
  - Modern, mobile-first design with clear feedback and error handling.
- **Privacy & Consent:**
  - All actions require valid consent tokens.
  - Tokens are securely stored and managed.
  - Logout/disconnect flow wipes all sensitive data.

---

### 📥 GmailScreen (Inbox to Insight Agent)

- **Gmail Integration:**
  - OAuth2 flow for secure Gmail connection.
  - Consent tokens for read/write are stored and used for all backend operations.
- **Inbox Management:**
  - Fetches and paginates Gmail inbox emails.
  - Tap to view full email details, long-press to select for batch actions.
  - "Load More" for infinite scrolling.
- **AI Features:**
  - **AI Insights:**
    - Auto-generates summaries, action items, key topics, priority, and sentiment for your inbox or individual emails.
    - Insights are shown in a dedicated tab, with context for selected emails.
  - **AI Content Generation:**
    - "Generate" modal allows you to create summaries, proposals, or analyses for selected emails.
    - Custom instructions can be provided for tailored AI output.
    - Generated content is displayed in a scrollable card, with option to regenerate.
  - **Smart Reply:**
    - For any email, generate a smart reply using AI (ChatGPT) in various styles (professional, casual, formal, brief, detailed).
    - Copy the reply or open Gmail with the reply pre-filled.
  - **Categorization, Action Items, and More:**
    - (Planned/partially implemented) Categorize emails, extract action items, generate meeting summaries, analyze sentiment trends, and create status reports or digests.
- **UI/UX:**
  - Animated entrance, tabbed navigation (Inbox, Insights, Generated).
  - Pull-to-refresh for real-time sync.
  - Modals for email details, smart reply, and content generation.
  - Modern, Gmail-like design with avatars, selection indicators, and clear feedback.
- **Privacy & Consent:**
  - All actions require valid consent tokens.
  - Tokens are securely stored and managed.
  - Logout/disconnect flow wipes all sensitive data.

---

### 🔗 How the App Connects to the Backend

- **OAuth2 Flows:**
  - Both calendar and Gmail screens initiate OAuth2 flows via the backend, which issues cryptographically signed consent tokens.
  - Tokens are stored in `AsyncStorage` and used for all API calls.
- **API Communication:**
  - All sensitive operations (fetching events/emails, creating events, generating AI content) are performed via backend endpoints, with tokens validated on every call.
  - The app never accesses Google APIs directly—everything is routed through the consent-protocol backend for privacy and auditability.
- **AI Features:**
  - AI-powered features (suggestions, insights, smart replies, content generation) are powered by backend endpoints that use OpenAI (ChatGPT) and custom logic.

---

### 🧩 Architecture Overview

- **Screens:**
  - `src/screens/CalendarScreen.tsx`: Calendar management, AI scheduling, event creation, analytics.
  - `src/screens/GmailScreen.tsx`: Gmail inbox, AI insights, smart reply, content generation.
- **Services:**
  - `src/services/api.ts`: Handles backend API communication.
  - `src/services/calendar.ts`: Integrates with device and Google calendars.
  - `src/services/agent_communication.ts`: (For GmailScreen) Handles smart reply and other agent features.
- **State Management:**
  - Uses React hooks and `AsyncStorage` for token and user state.
- **UI:**
  - Modern, animated, mobile-first design with clear feedback, error handling, and accessibility.

---

### 🚀 Key User Flows

- **Connect Google Calendar or Gmail:**
  - User taps "Connect" → OAuth2 flow → Consent tokens issued → App stores tokens and syncs data.
- **View and Manage Events/Emails:**
  - Calendar: View, create, and manage events; see AI suggestions and analytics.
  - Gmail: View, select, and analyze emails; generate AI insights and content.
- **AI-Powered Actions:**
  - Calendar: Smart scheduling, pattern learning, optimal time suggestions.
  - Gmail: Inbox summarization, action item extraction, smart reply, content/proposal/analysis generation.
- **Privacy:**
  - All actions require explicit, cryptographically signed consent tokens.
  - User can disconnect at any time, wiping all sensitive data.

---