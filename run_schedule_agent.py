#!/usr/bin/env python3
"""
Schedule Agent Server Runner
Starts the FastAPI server for the schedule agent on port 8001
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from hushh_mcp.agents.schedule_agent.index import app as schedule_app

# Create main app and mount the schedule agent
app = FastAPI(title="PDA Schedule Agent", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the schedule agent
app.mount("/schedule-agent", schedule_app)

@app.get("/")
def root():
    return {"message": "PDA Schedule Agent is running", "agent": "schedule"}

@app.get("/health")
def health():
    return {"status": "healthy", "agent": "schedule"}

if __name__ == "__main__":
    print("🚀 Starting Hushh Schedule Agent...")
    print("📅 Calendar OAuth endpoint: http://0.0.0.0:8001/schedule-agent/auth/google")
    print("📊 Health check: http://0.0.0.0:8001/health")
    print("📚 API docs: http://0.0.0.0:8001/docs")
    print("🌐 Ngrok URL: https://5f9cda3742ae.ngrok-free.app")
    print("🔗 Calendar OAuth: https://5f9cda3742ae.ngrok-free.app/schedule-agent/auth/google")
    
    uvicorn.run(
        "run_schedule_agent:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    ) 