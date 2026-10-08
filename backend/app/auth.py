# -*- coding: utf-8 -*-
"""管理员鉴权：
   - 支持新的 session token（Authorization: Bearer <token>）
   - 保留旧 X-Admin-Token 作为应急通道（值等于 .env 的 ADMIN_TOKEN）
"""
from fastapi import Header, HTTPException
from app.config import settings
from app.db import check_admin_session


async def require_admin(
    authorization: str = Header(default=""),
    x_admin_token: str = Header(default=""),
):
    # 1. 新式：Bearer session token
    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if await check_admin_session(token):
            return True

    # 2. 旧式：X-Admin-Token（应急）
    if settings.admin_token and x_admin_token == settings.admin_token:
        return True

    raise HTTPException(status_code=401, detail="unauthorized")