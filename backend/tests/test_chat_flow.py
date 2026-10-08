# -*- coding: utf-8 -*-
"""
集成测试：走 FastAPI TestClient 完整链路，但 monkeypatch 掉 LLM。
0 API 消耗。
"""
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def client(monkeypatch):
    # ---- mock LLM：假装流式返回固定回答 ----
    async def fake_stream(messages, cancel_event=None):
        yield "我做过 CV_Bot [F-020]", {"prompt_tokens": 5, "completion_tokens": 5}

    monkeypatch.setattr("app.routers.chat.stream_chat", fake_stream)

    # ---- 重置限流器，避免与其他测试互相污染 ----
    from app.middleware import ratelimit
    ratelimit.init_limiter(per_minute=20)

    from app.main import app
    return TestClient(app)

def _is_rate_limited(r) -> bool:
    ct = r.headers.get("content-type", "")
    if "application/json" not in ct:
        return False
    try:
        return r.json().get("error") == "rate_limited"
    except Exception:
        return False

def test_normal_chat_succeeds(client):
    r = client.post("/api/chat", json={"session_id": "s1", "message": "你做过哪些项目？"})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers.get("content-type", "")
    assert "delta" in r.text

def test_rate_limit_blocks_after_20(client):
    blocked_at = None
    for i in range(1, 26):
        r = client.post("/api/chat", json={"session_id": f"s{i}", "message": "hi"})
        if _is_rate_limited(r):
            blocked_at = i
            break
    assert blocked_at == 21, f"预期第 21 次被拦，实际第 {blocked_at} 次"

def test_empty_message_rejected(client):
    r = client.post("/api/chat", json={"session_id": "s-empty", "message": ""})
    assert r.status_code == 200
    assert r.json().get("error") == "empty message"

def test_cancel_endpoint(client):
    r = client.post("/api/cancel", json={"session_id": "no-such"})
    assert r.status_code == 200
    assert r.json().get("ok") is False