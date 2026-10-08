# -*- coding: utf-8 -*-
from fastapi import APIRouter
from app.db import get_history, delete_session

router = APIRouter()

@router.get("/session/{session_id}/history")
async def history(session_id: str):
    return {"messages": await get_history(session_id)}

@router.get("/session/{session_id}/export")
async def export(session_id: str):
    msgs = await get_history(session_id)
    return {
        "session_id": session_id,
        "exported_at": __import__("datetime").datetime.utcnow().isoformat(),
        "messages": msgs,
    }

@router.delete("/session/{session_id}")
async def delete(session_id: str):
    n = await delete_session(session_id)
    return {"ok": True, "deleted_messages": n}
