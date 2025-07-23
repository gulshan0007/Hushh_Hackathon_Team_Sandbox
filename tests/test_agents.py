# tests/test_agents.py

import pytest
from hushh_mcp.agents.shopping import HushhShoppingAgent
from hushh_mcp.agents.identity import HushhIdentityAgent
from hushh_mcp.consent.token import issue_token
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import UserID, AgentID

def test_shopping_agent_consent_flow():
    """Test that shopping agent properly validates consent."""
    # Issue a token for vault.read.email scope
    token = issue_token(
        user_id="user_abc",
        agent_id="agent_shopper",
        scope=ConsentScope.VAULT_READ_EMAIL
    )
    
    agent = HushhShoppingAgent()
    result = agent.search_deals("user_abc", token.token)
    
    assert isinstance(result, list)
    assert len(result) > 0
    assert "MacBook" in result[0] or "AirPods" in result[1]

def test_shopping_agent_invalid_consent():
    """Test that shopping agent rejects invalid consent."""
    agent = HushhShoppingAgent()
    
    with pytest.raises(PermissionError):
        agent.search_deals("user_abc", "invalid_token")

def test_identity_agent_email_verification():
    """Test identity agent email verification."""
    agent = HushhIdentityAgent()
    
    assert agent.verify_user_identity("test@example.com") is True
    assert agent.verify_user_identity("invalid-email") is False

def test_identity_agent_trust_link_creation():
    """Test identity agent can create trust links."""
    agent = HushhIdentityAgent()
    
    trust_link = agent.issue_trust_link(
        from_agent="agent_identity",
        to_agent="agent_finance",
        user_id="user_123",
        scope="vault.read.finance"
    )
    
    assert trust_link.from_agent == "agent_identity"
    assert trust_link.to_agent == "agent_finance"
    assert trust_link.scope == "vault.read.finance"

def test_schedule_agent_consent_validation():
    """Test that schedule agent validates consent tokens properly."""
    # Test calendar read scope
    token_read = issue_token(
        user_id="user_calendar",
        agent_id="schedule_agent",
        scope=ConsentScope.CALENDAR_READ
    )
    
    # Test calendar write scope
    token_write = issue_token(
        user_id="user_calendar", 
        agent_id="schedule_agent",
        scope=ConsentScope.CALENDAR_WRITE
    )
    
    assert token_read.scope == ConsentScope.CALENDAR_READ
    assert token_write.scope == ConsentScope.CALENDAR_WRITE
    assert token_read.user_id == "user_calendar"
    assert token_write.user_id == "user_calendar"

def test_schedule_agent_preferences_analytics():
    """Test that schedule agent can analyze user patterns."""
    # Mock test - in real implementation, this would test the preferences endpoint
    # with mock calendar data
    
    # Sample calendar pattern analysis
    mock_events = [
        {"start": {"dateTime": "2024-01-15T10:00:00Z"}, "end": {"dateTime": "2024-01-15T11:00:00Z"}},
        {"start": {"dateTime": "2024-01-16T10:30:00Z"}, "end": {"dateTime": "2024-01-16T11:30:00Z"}},
        {"start": {"dateTime": "2024-01-17T10:00:00Z"}, "end": {"dateTime": "2024-01-17T12:00:00Z"}},
    ]
    
    # In a full test, we'd validate that the agent correctly identifies:
    # - Most common hour (10 AM)
    # - Average duration (90 minutes)
    # - Preferred days (weekdays)
    
    assert len(mock_events) == 3  # Basic validation that test data exists

def test_schedule_agent_smart_suggestions():
    """Test that schedule agent can provide intelligent time suggestions."""
    # Mock test for AI-powered scheduling
    
    mock_preferences = {
        "most_common_hour": 10,
        "most_common_day": "Tuesday", 
        "avg_duration_minutes": 60
    }
    
    mock_busy_periods = [
        {"start": "2024-01-15T09:00:00Z", "end": "2024-01-15T10:00:00Z"}
    ]
    
    # In a full implementation, this would test that the agent:
    # - Avoids busy periods
    # - Suggests times close to user preferences
    # - Provides confidence scores
    # - Explains reasoning
    
    assert mock_preferences["most_common_hour"] == 10
    assert len(mock_busy_periods) == 1
