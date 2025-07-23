"""
Main server runner for Inbox to Insight Agent
Run this file to start the backend server
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from hushh_mcp.agents.inbox_agent.index import app as inbox_app
from config import HOST, PORT, DEBUG


# Create main FastAPI app
app = FastAPI(
    title="Hushh Inbox to Insight Agent",
    description="AI-powered email analysis and content generation",
    version="1.0.0"
)

# Enable CORS for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the inbox agent
app.mount("/inbox-agent", inbox_app)

@app.get("/")
def root():
    return {
        "message": "Hushh Inbox to Insight Agent is running!",
        "agent": "inbox_agent",
        "version": "1.0.0",
        "docs": "/docs",
        "inbox_agent_health": "/inbox-agent/health"
    }

if __name__ == "__main__":
    print("🚀 Starting Hushh Inbox to Insight Agent...")
    print(f"📧 Gmail OAuth endpoint: http://{HOST}:{PORT}/inbox-agent/auth/gmail")
    print(f"📊 Health check: http://{HOST}:{PORT}/inbox-agent/health")
    print(f"📚 API docs: http://{HOST}:{PORT}/docs")
    print(f"🌐 Ngrok URL: https://bdcfc7c11594.ngrok-free.app")
    print(f"🔗 Gmail OAuth: https://bdcfc7c11594.ngrok-free.app/inbox-agent/auth/gmail")
    
    uvicorn.run(
        "run_inbox_agent:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="info"
    ) 