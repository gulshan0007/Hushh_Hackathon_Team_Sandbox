# 🤫 Hushh AI Consent Protocol (HushhMCP)

Welcome to the official Python implementation of the **HushhMCP** — a programmable trust and consent protocol for AI agents. This repo powers the agentic infrastructure for the **Hushh PDA Hackathon**, where real humans give real consent to AI systems acting on their behalf.

> 🔐 Built with privacy, security, modularity, and elegance in mind.

---

## 🚀 Quick Setup Guide

### Prerequisites
- **Python 3.9+**
- **Node.js 16+**
- **React Native CLI**
- **Google Cloud Console account** (for OAuth credentials)

### 1. Clone and Setup Backend
```bash
git clone https://github.com/gulshan0007/Hushh_Hackathon_Team_Sandbox.git
cd consent-protocol

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (see Configuration section below)
```

### 2. Configure Environment Variables
Create `.env` file in `consent-protocol/` directory:

```env
# Server port (optional if not running web server)
PORT=3000
# 🔐 HMAC signing key (64-character hex, 256-bit)
SECRET_KEY=<secret-key>
# 🔒 Vault AES encryption key (64-character hex, 256-bit)
VAULT_ENCRYPTION_KEY=<VAULT_ENCRYPTION_KEY>
# ⏱️ Expiration durations (milliseconds)
DEFAULT_CONSENT_TOKEN_EXPIRY_MS=604800000
DEFAULT_TRUST_LINK_EXPIRY_MS=2592000000
# 🌱 App context
ENVIRONMENT=development
AGENT_ID=agent_hushh_local
HUSHH_HACKATHON=enabled
GOOGLE_CALENDAR_TOKEN=<your-calendar-token>

GOOGLE_CALENDAR_REFRESH_TOKEN=<your-refresh-token>

GOOGLE_CALENDAR_CLIENT_ID=<your-calendar-client-id>
GOOGLE_CALENDAR_CLIENT_SECRET=<your-calendar-client-secret>

GOOGLE_REDIRECT_URI=https://<your-ngrok-url>.ngrok-free.app/schedule-agent/auth/google/callback

GOOGLE_GMAIL_CLIENT_ID=<your-gmail-client-id>
GOOGLE_GMAIL_CLIENT_SECRET=<your-gmail-client-secret>
OPENAI_API_KEY=<your-openai-api-key>
```

### 3. Setup Google Cloud Console
1. **Create a Google Cloud Project**
2. **Enable Gmail API and Google Calendar API**
3. **Create OAuth 2.0 credentials** for both Gmail and Calendar
4. **Add authorized redirect URIs:**
   - `https://your-ngrok-url.ngrok-free.app/inbox-agent/auth/gmail/callback`
   - `https://your-ngrok-url.ngrok-free.app/schedule-agent/auth/google/callback`

### 4. Run Backend Server
```bash
# Start ngrok for development tunneling
ngrok http 8000

# Update BACKEND_URL in .env with ngrok URL
# Run the unified agent server
python run_unified_agent.py
```

### 5. Setup Mobile App
```bash
cd PDAMobileApp

# Install Node.js dependencies
npm install

# Start the react-native development server
npx react-native run-android
# or for iOS: npx react-native run-ios
```

### 6. Test the System
```bash
# Run backend tests
cd consent-protocol
python -m pytest tests/ -v

# Run demo walkthrough
python demo_walkthrough.py
```

---

## 🧪 Key Demo Features

### **Calendar Agent Demo:**
1. **Connect Google Calendar** via OAuth2
2. **View Events** from both local and Google calendars
3. **Create Smart Events** with AI time suggestions
4. **Pattern Learning** - see your scheduling preferences
5. **Conflict Detection** - AI suggests optimal times

### **Inbox Agent Demo:**
1. **Connect Gmail** via OAuth2
2. **Browse Inbox** with infinite scrolling
3. **AI Analysis** - get summaries and insights
4. **Smart Reply** - generate professional responses
5. **Batch Operations** - analyze multiple emails

### **Cross-Agent Communication:**
1. **Email to Calendar** - convert email threads to events
2. **Consent Validation** - every action requires tokens
3. **Privacy Controls** - revoke access anytime

---

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

## 🧠 What is HushhMCP?

HushhMCP (Hushh Micro Consent Protocol) is the cryptographic backbone for **Personal Data Agents (PDAs)** that can:

- 🔐 Issue & verify **cryptographically signed consent tokens**
- 🔁 Delegate trust across **agent-to-agent (A2A) links**
- 🗄️ Store & retrieve **AES-encrypted personal data**
- 🤖 Operate within well-scoped, revocable, user-issued permissions

Inspired by biology (operons), economics (trust-based contracts), and real-world privacy laws.

---

## 🏗️ Key Concepts

| Concept         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| **Consent Token** | A signed proof that a user granted an agent a specific permission          |
| **TrustLink**     | A time-bound signed relationship between two agents                        |
| **Vault**         | An encrypted datastore with AES-256-GCM for storing user data              |
| **Operons**       | Reusable, modular agent actions — like genes in biology                    |
| **Agents**        | Modular, scoped AI workers that operate on your behalf, with your consent  |

---

## 📦 Folder Structure

```bash
hushh-ai-consent-protocol/
├── hushh_mcp/                # Core protocol logic (modular)
│   ├── config.py             # .env loader + global settings
│   ├── constants.py          # Consent scopes, prefixes, default values
│   ├── types.py              # Pydantic models: ConsentToken, TrustLink, VaultRecord
│   ├── consent/token.py      # issue_token(), validate_token(), revoke_token()
│   ├── trust/link.py         # TrustLink creation + verification
│   ├── vault/encrypt.py      # AES-256-GCM encryption/decryption
│   ├── agents/               # Real agents
│   │   ├── inbox_agent/      # Gmail AI agent
│   │   └── schedule_agent/   # Calendar AI agent
│   ├── operons/verify_email.py  # Reusable email validation logic
│   └── cli/generate_agent.py    # CLI to scaffold new agents
├── tests/                   # All pytest test cases
├── .env.example            # Sample environment variables
├── requirements.txt        # All runtime + dev dependencies
├── README.md               # You are here
└── docs/                   # Hackathon + protocol documentation
````

---

## 🚀 Getting Started

### 1. 📥 Clone & Install

```bash
git clone <your-repo-url>
cd consent-protocol
pip install -r requirements.txt
```

### 2. 🔐 Configure Secrets

Create your `.env` file:

```bash
cp .env.example .env
```

And paste in secure keys (generated via `python -c "import secrets; print(secrets.token_hex(32))"`).

---

## 🧪 Running Tests

```bash
pytest
```

Includes full test coverage for:

* Consent issuance, validation, revocation
* TrustLink creation, scope checks
* Vault encryption roundtrip
* Real agent workflows (schedule_agent, inbox_agent)

---

## ⚙️ CLI Agent Generator

Scaffold a new agent with:

```bash
python hushh_mcp/cli/generate_agent.py my-new-agent
```

Outputs:

```bash
hushh_mcp/agents/my_new_agent/index.py
hushh_mcp/agents/my_new_agent/manifest.py
```

---

## 🔐 Security Architecture

* All **tokens and trust links are stateless + signed** using HMAC-SHA256
* Vault data is **encrypted using AES-256-GCM**, with IV + tag integrity
* Agent actions are **fully gated by scope + revocation checks**
* System is **testable, auditable, and modular**

---

## 📚 Documentation

Explore full guides in `/docs`:

* `docs/index.md` — Overview & roadmap
* `docs/consent.md` — Consent token lifecycle
* `docs/agents.md` — Building custom agents
* `docs/faq.md`
