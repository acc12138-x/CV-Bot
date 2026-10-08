# -*- coding: utf-8 -*-
from fastapi import APIRouter
from app.routers.chat import get_cancel_event

router = APIRouter()

@router.post("/cancel")
async def cancel(payload: dict):
    sid = payload.get("session_id", "")
    evt = get_cancel_event(sid)
    if evt is not None:
        evt.set()
        return {"ok": True}
    return {"ok": False, "reason": "no_active_stream"}
