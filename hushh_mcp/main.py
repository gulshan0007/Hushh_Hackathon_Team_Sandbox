from fastapi import FastAPI
from hushh_mcp.agents.schedule_agent.index import router as schedule_router

app = FastAPI()

# Register your agent's router
app.include_router(schedule_router, prefix="/schedule-agent") 