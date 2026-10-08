# -*- coding: utf-8 -*-
import yaml
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi import Header
from app.auth import require_admin
from app.config import settings
from app.services import site_config
from app.services.facts import all_facts, save_facts
from app.services.hub import hub
from app.db import (
    list_all_sessions, list_active_sessions, get_history, set_mode, get_mode,
    save_message, log_event, mark_session_seen,
    verify_admin_password, set_admin_password,
    create_admin_session, revoke_admin_session,
)

router = APIRouter(dependencies=[Depends(require_admin)])
auth_router = APIRouter()  # 登录相关：无鉴权依赖

RESUME_DIR = Path("./data")
ALLOWED_RESUME_EXT = {".pdf", ".docx"}
MAX_RESUME_MB = 10

STATIC_DIR = Path("./static")
ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_MEDIA_EXT = ALLOWED_VIDEO_EXT | ALLOWED_IMAGE_EXT
MAX_VIDEO_MB = 50
MAX_IMAGE_MB = 5


def _media_kind(ext: str) -> str:
    if ext in ALLOWED_VIDEO_EXT:
        return "video"
    if ext in ALLOWED_IMAGE_EXT:
        return "image"
    return "unknown"

# ---------- Site config ----------
@router.get("/admin/site")
async def get_all():
    return await site_config.get_all()

@router.put("/admin/site/{key}")
async def update_site(key: str, payload: dict):
    if key not in site_config.VALID_KEYS:
        raise HTTPException(400, f"invalid key: {key}")
    if "value" not in payload:
        raise HTTPException(400, "missing 'value'")
    await site_config.set_config(key, payload["value"])
    return {"ok": True, "key": key}

@router.post("/admin/site/reset/{key}")
async def reset_site(key: str):
    if key not in site_config.VALID_KEYS:
        raise HTTPException(400, f"invalid key: {key}")
    await site_config.set_config(key, site_config.DEFAULTS[key])
    return {"ok": True, "key": key}

# ---------- Facts ----------
@router.get("/admin/facts")
async def get_facts():
    return {"facts": all_facts()}

@router.get("/admin/facts/raw")
async def get_facts_raw():
    p = Path(settings.facts_path)
    return {"yaml": p.read_text(encoding="utf-8") if p.exists() else ""}

@router.put("/admin/facts/raw")
async def put_facts_raw(payload: dict):
    raw = payload.get("yaml", "")
    try:
        parsed = yaml.safe_load(raw) or []
    except yaml.YAMLError as e:
        raise HTTPException(400, f"YAML 解析失败：{e}")
    if not isinstance(parsed, list):
        raise HTTPException(400, "facts.yaml 顶层必须是列表")
    for i, f in enumerate(parsed):
        if not isinstance(f, dict) or "id" not in f:
            raise HTTPException(400, f"第 {i+1} 条缺少 id 字段")
    save_facts(parsed)
    return {"ok": True, "count": len(parsed)}

# ---------- Resume ----------
@router.get("/admin/resume/status")
async def resume_status():
    for ext in ALLOWED_RESUME_EXT:
        p = RESUME_DIR / f"resume{ext}"
        if p.exists():
            return {"exists": True, "file": p.name, "size": p.stat().st_size}
    return {"exists": False}

@router.post("/admin/resume")
async def upload_resume(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RESUME_EXT:
        raise HTTPException(400, f"只支持 {', '.join(ALLOWED_RESUME_EXT)}")
    content = await file.read()
    if len(content) > MAX_RESUME_MB * 1024 * 1024:
        raise HTTPException(400, f"文件超过 {MAX_RESUME_MB} MB")
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    for e in ALLOWED_RESUME_EXT:
        old = RESUME_DIR / f"resume{e}"
        if old.exists():
            old.unlink()
    target = RESUME_DIR / f"resume{ext}"
    target.write_bytes(content)
    return {"ok": True, "file": target.name, "size": len(content)}

@router.delete("/admin/resume")
async def delete_resume():
    n = 0
    for ext in ALLOWED_RESUME_EXT:
        p = RESUME_DIR / f"resume{ext}"
        if p.exists():
            p.unlink()
            n += 1
    return {"ok": True, "deleted": n}

# ---------- Stats ----------
@router.get("/admin/stats")
async def stats():
    import aiosqlite
    from app.db import _db_file
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT COUNT(*) FROM messages")
        msg_count = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COUNT(DISTINCT session_id) FROM messages")
        sess_count = (await cur.fetchone())[0]
        cur = await db.execute("SELECT COALESCE(SUM(cost_cny),0) FROM daily_usage")
        total_cost = (await cur.fetchone())[0]
    return {
        "messages": msg_count,
        "sessions": sess_count,
        "total_cost_cny": round(total_cost, 4),
        "model": settings.deepseek_model,
        "daily_budget_cny": settings.daily_budget_cny,
    }

# ---------- 会话记录 ----------
@router.get("/admin/sessions")
async def all_sessions(limit: int = 200):
    return {"sessions": await list_all_sessions(limit=limit)}

@router.get("/admin/sessions/active")
async def active_sessions(minutes: int = 60):
    return {"sessions": await list_active_sessions(minutes=minutes)}

@router.get("/admin/sessions/{session_id}")
async def session_detail(session_id: str):
    mode = await get_mode(session_id)
    messages = await get_history(session_id)
    return {"session_id": session_id, "mode": mode, "messages": messages}

@router.post("/admin/sessions/{session_id}/mark_seen")
async def mark_seen(session_id: str):
    await mark_session_seen(session_id)
    return {"ok": True}

@router.delete("/admin/sessions/{session_id}")
async def delete_session_admin(session_id: str):
    from app.db import delete_session
    n = await delete_session(session_id)
    return {"ok": True, "deleted_messages": n}

# ---------- 接管 ----------
@router.post("/admin/sessions/{session_id}/takeover")
async def takeover(session_id: str):
    await set_mode(session_id, "human")
    await log_event(session_id, "takeover", "by admin")
    await hub.publish(session_id, {"type": "human_takeover"})
    return {"ok": True, "mode": "human"}

@router.post("/admin/sessions/{session_id}/release")
async def release(session_id: str):
    await set_mode(session_id, "ai")
    await log_event(session_id, "release", "by admin")
    await hub.publish(session_id, {"type": "human_release"})
    return {"ok": True, "mode": "ai"}

@router.post("/admin/sessions/{session_id}/say")
async def admin_say(session_id: str, payload: dict):
    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(400, "empty content")
    if await get_mode(session_id) != "human":
        await set_mode(session_id, "human")
        await hub.publish(session_id, {"type": "human_takeover"})
    await save_message(session_id, "human", content)
    await log_event(session_id, "human_message", content[:200])
    await hub.publish(session_id, {"type": "human_message", "content": content})
    return {"ok": True}

# ---------- 视频上传 ----------
@router.get("/admin/videos")
async def list_videos():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in sorted(STATIC_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXT:
            files.append({
                "name": f.name,
                "size": f.stat().st_size,
                "url": f"/static/{f.name}",
            })
    return {"videos": files}

@router.post("/admin/videos")
async def upload_video(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(400, f"只支持 {', '.join(ALLOWED_VIDEO_EXT)}")
    content = await file.read()
    if len(content) > MAX_VIDEO_MB * 1024 * 1024:
        raise HTTPException(400, f"文件超过 {MAX_VIDEO_MB} MB")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    # 文件名保留原始名，避免重名加时间戳
    safe_name = Path(file.filename or "video").name.replace(" ", "_")
    target = STATIC_DIR / safe_name
    # 如果已存在，加时间戳
    if target.exists():
        import time
        stem = target.stem
        target = STATIC_DIR / f"{stem}_{int(time.time())}{target.suffix}"
    target.write_bytes(content)
    return {"ok": True, "name": target.name, "url": f"/static/{target.name}", "size": len(content)}

@router.delete("/admin/videos/{name}")
async def delete_video(name: str):
    # 防路径穿越
    safe = Path(name).name
    p = STATIC_DIR / safe
    if not p.exists():
        raise HTTPException(404, "文件不存在")
    p.unlink()
    return {"ok": True}

# ==================== 登录 / 改密码（挂 auth_router） ====================

@auth_router.post("/admin/login")
async def admin_login(payload: dict):
    pwd = (payload.get("password") or "").strip()
    if not pwd:
        raise HTTPException(400, "密码不能为空")
    if not await verify_admin_password(pwd):
        raise HTTPException(401, "密码错误")
    token = await create_admin_session()
    return {"ok": True, "token": token}


@auth_router.post("/admin/logout")
async def admin_logout(authorization: str = Header(default="")):
    token = ""
    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    await revoke_admin_session(token)
    return {"ok": True}


@auth_router.post("/admin/change-password")
async def admin_change_password(
    payload: dict,
    authorization: str = Header(default=""),
    x_admin_token: str = Header(default=""),
):
    # 检查旧鉴权：session token 或 旧 ADMIN_TOKEN 都算已登录
    authorized = False
    if authorization.startswith("Bearer "):
        from app.db import check_admin_session
        if await check_admin_session(authorization[7:].strip()):
            authorized = True
    if not authorized and settings.admin_token and x_admin_token == settings.admin_token:
        authorized = True
    if not authorized:
        raise HTTPException(401, "未登录")

    old_pwd = (payload.get("old_password") or "").strip()
    new_pwd = (payload.get("new_password") or "").strip()
    if len(new_pwd) < 8:
        raise HTTPException(400, "新密码至少 8 位")
    if not await verify_admin_password(old_pwd):
        raise HTTPException(401, "旧密码错误")

    await set_admin_password(new_pwd)
    return {"ok": True, "message": "密码已修改，请用新密码重新登录"}

# ==================== 通用媒体上传（视频 + 图片） ====================
@router.get("/admin/media")
async def list_media():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for f in sorted(STATIC_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_MEDIA_EXT:
            ext = f.suffix.lower()
            items.append({
                "name": f.name,
                "size": f.stat().st_size,
                "url": f"/static/{f.name}",
                "type": _media_kind(ext),
            })
    return {"items": items}


@router.post("/admin/media")
async def upload_media(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_MEDIA_EXT:
        raise HTTPException(400, f"只支持 {', '.join(sorted(ALLOWED_MEDIA_EXT))}")

    kind = _media_kind(ext)
    limit_mb = MAX_VIDEO_MB if kind == "video" else MAX_IMAGE_MB

    content = await file.read()
    if len(content) > limit_mb * 1024 * 1024:
        raise HTTPException(400, f"{kind} 文件超过 {limit_mb} MB")

    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "media").name.replace(" ", "_")
    target = STATIC_DIR / safe_name
    if target.exists():
        import time
        target = STATIC_DIR / f"{target.stem}_{int(time.time())}{target.suffix}"

    target.write_bytes(content)
    return {
        "ok": True,
        "name": target.name,
        "url": f"/static/{target.name}",
        "size": len(content),
        "type": kind,
    }


@router.delete("/admin/media/{name}")
async def delete_media(name: str):
    safe = Path(name).name
    p = STATIC_DIR / safe
    if not p.exists():
        raise HTTPException(404, "文件不存在")
    p.unlink()
    return {"ok": True}

# ==================== 飞书测试 ====================
@router.post("/admin/feishu/test")
async def feishu_test():
    from app.services.feishu import send_test_message
    ok, reason = await send_test_message()
    if ok:
        return {"ok": True, "message": "已发送，请查看飞书"}
    return {"ok": False, "message": f"发送失败：{reason}"}