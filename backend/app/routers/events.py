# -*- coding: utf-8 -*-
"""访客常驻 SSE：接收人工消息、接管/释放通知。
   心跳 15s，防止代理掐断。"""
import asyncio, json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.hub import hub

router = APIRouter()

def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

@router.get("/session/{session_id}/events")
async def events(session_id: str, request: Request):
    q = await hub.subscribe(session_id)

    async def gen():
        try:
            yield sse({"type": "connected", "session_id": session_id})
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield sse(ev)
                except asyncio.TimeoutError:
                    # SSE 注释，保持连接；前端会忽略
                    yield ": ping\n\n"
        finally:
            await hub.unsubscribe(session_id, q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )