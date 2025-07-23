"""
Tests for Agent-to-Agent Communication System
"""

import pytest
from datetime import datetime, timedelta
from hushh_mcp.agents.agent_communication import AgentMessage, AgentCommunicationSystem
from hushh_mcp.constants import ConsentScope
from hushh_mcp.types import AgentID, UserID

@pytest.fixture
def comm_system():
    return AgentCommunicationSystem(encryption_key="test_key_123")

@pytest.fixture
def test_agents():
    return {
        "inbox": AgentID("inbox_agent"),
        "schedule": AgentID("schedule_agent"),
        "user": UserID("test_user_123")
    }

def test_agent_message_creation():
    """Test creating and serializing agent messages"""
    msg = AgentMessage(
        from_agent=AgentID("inbox_agent"),
        to_agent=AgentID("schedule_agent"),
        user_id=UserID("test_user"),
        message_type="test",
        payload={"key": "value"},
        trust_link="test_link"
    )
    
    assert msg.from_agent == "inbox_agent"
    assert msg.to_agent == "schedule_agent"
    assert msg.message_type == "test"
    assert isinstance(msg.timestamp, datetime)

    # Test serialization
    msg_dict = msg.to_dict()
    assert isinstance(msg_dict["timestamp"], str)
    
    # Test deserialization
    msg2 = AgentMessage.from_dict(msg_dict)
    assert msg2.from_agent == msg.from_agent
    assert msg2.payload == msg.payload

def test_trust_establishment(comm_system, test_agents):
    """Test creating trust links between agents"""
    trust_link = comm_system.establish_trust(
        from_agent=test_agents["inbox"],
        to_agent=test_agents["schedule"],
        user_id=test_agents["user"],
        scopes=[ConsentScope.CALENDAR_READ]
    )
    
    assert trust_link is not None
    assert len(comm_system.trust_links) == 1

def test_message_sending(comm_system, test_agents):
    """Test sending messages between agents"""
    success = comm_system.send_message(
        from_agent=test_agents["inbox"],
        to_agent=test_agents["schedule"],
        user_id=test_agents["user"],
        message_type="email_to_event",
        payload={"subject": "Meeting Tomorrow", "time": "2024-01-20T10:00:00Z"},
        required_scopes=[ConsentScope.CALENDAR_WRITE]
    )
    
    assert success is True
    assert len(comm_system.message_queue[test_agents["schedule"]]) == 1

def test_message_receiving(comm_system, test_agents):
    """Test receiving messages for an agent"""
    # Send two messages
    comm_system.send_message(
        from_agent=test_agents["inbox"],
        to_agent=test_agents["schedule"],
        user_id=test_agents["user"],
        message_type="email_to_event",
        payload={"subject": "Meeting 1"},
        required_scopes=[ConsentScope.CALENDAR_WRITE]
    )
    
    comm_system.send_message(
        from_agent=test_agents["inbox"],
        to_agent=test_agents["schedule"],
        user_id=UserID("other_user"),
        message_type="email_to_event",
        payload={"subject": "Meeting 2"},
        required_scopes=[ConsentScope.CALENDAR_WRITE]
    )
    
    # Test receiving all messages
    all_messages = comm_system.receive_messages(test_agents["schedule"])
    assert len(all_messages) == 2
    
    # Test receiving filtered messages
    filtered_messages = comm_system.receive_messages(
        test_agents["schedule"],
        user_id=test_agents["user"]
    )
    assert len(filtered_messages) == 1
    assert filtered_messages[0].payload["subject"] == "Meeting 1"

def test_invalid_trust_link(comm_system, test_agents):
    """Test message sending with invalid trust link"""
    # Manually set an expired trust link
    agent_pair = f"{test_agents['inbox']}:{test_agents['schedule']}:{test_agents['user']}"
    comm_system.trust_links[agent_pair] = "invalid_link"
    
    success = comm_system.send_message(
        from_agent=test_agents["inbox"],
        to_agent=test_agents["schedule"],
        user_id=test_agents["user"],
        message_type="test",
        payload={},
        required_scopes=[ConsentScope.CALENDAR_READ]
    )
    
    assert success is False 