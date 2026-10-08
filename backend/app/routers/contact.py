# -*- coding: utf-8 -*-
from fastapi import APIRouter
from app.db import log_event
from app.services.feishu import notify_feishu, classify

router = APIRouter()


@router.post("/contact-request")
async def contact_request(payload: dict):
    session_id = payload.get("session_id", "unknown")
    reason     = payload.get("reason", "访客请求联系方式")
    level      = await classify(reason)

    text = (
        f"会话：{session_id}\n"
        f"原因：{reason}\n"
        f"级别：{'加急' if level == 'urgent' else '普通'}"
    )
    ok = await notify_feishu(text, level=level, session_id=session_id)
    await log_event(session_id, "contact_request", f"level={level} sent={ok}")
    return {"ok": ok, "level": level}