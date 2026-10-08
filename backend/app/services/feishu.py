# -*- coding: utf-8 -*-
"""飞书转人工通知。

配置来源优先级：
1. DB 里的 site_config.feishu（后台可改）
2. .env 的 FEISHU_WEBHOOK_URL（初始值）
"""
import httpx
from app.config import settings


async def _get_config() -> dict:
    """读 DB 配置，失败则用 .env 兜底。"""
    cfg = {
        "webhookUrl": settings.feishu_webhook_url or "",
        "urgentKeywords": [
            "合作", "面试", "薪资", "招聘", "offer", "Offer", "OFFER",
            "简历", "约", "内推", "岗位", "入职", "谈",
        ],
        "enabled": True,
    }
    try:
        from app.services import site_config
        stored = await site_config.get_config("feishu")
        if isinstance(stored, dict):
            if stored.get("webhookUrl"):
                cfg["webhookUrl"] = stored["webhookUrl"].strip()
            if isinstance(stored.get("urgentKeywords"), list):
                cfg["urgentKeywords"] = stored["urgentKeywords"]
            if "enabled" in stored:
                cfg["enabled"] = bool(stored["enabled"])
    except Exception:
        pass
    return cfg


async def classify(message: str) -> str:
    cfg = await _get_config()
    for kw in cfg.get("urgentKeywords", []):
        if kw and kw in message:
            return "urgent"
    return "normal"


async def _send(payload: dict) -> tuple[bool, str]:
    cfg = await _get_config()
    url = cfg.get("webhookUrl", "")
    if not url:
        return False, "webhook 未配置"
    if not cfg.get("enabled", True):
        return False, "飞书通知已关闭"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                return False, f"HTTP {r.status_code}: {r.text[:200]}"
            return True, "ok"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


async def _resolve_site_url() -> str:
    try:
        from app.services import site_config
        site = await site_config.get_config("site")
        url = (site or {}).get("siteUrl", "").strip()
        if url:
            return url.rstrip("/")
    except Exception:
        pass
    return ""


def _build_link_line(site_url: str, session_id: str) -> str:
    if not site_url or not session_id:
        return ""
    url = f"{site_url}/admin?session={session_id}"
    return f'\n\n👉 <a href="{url}">打开会话</a>'


async def notify_feishu(text: str, level: str = "normal", session_id: str = "") -> bool:
    site_url = await _resolve_site_url()
    link_line = _build_link_line(site_url, session_id)

    if level == "urgent":
        content = text + link_line
        payload = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {"tag": "plain_text", "content": "🚨 CV_Bot · 加急转人工"},
                    "template": "red",
                },
                "elements": [
                    {"tag": "div", "text": {"tag": "lark_md", "content": content}},
                    {"tag": "hr"},
                    {"tag": "note", "elements": [
                        {"tag": "plain_text", "content": "来自 CV_Bot · 简历机器人"},
                    ]},
                ],
            },
        }
    else:
        content = text
        if link_line:
            clean = link_line.replace("👉 ", "").strip()
            clean = clean.replace('<a href="', "").replace('">打开会话</a>', "")
            content = f"{text}\n\n👉 打开会话：{clean}"
        payload = {
            "msg_type": "text",
            "content": {"text": f"【CV_Bot · 转人工】\n{content}"},
        }

    ok, reason = await _send(payload)
    if not ok:
        print(f"[feishu] 发送失败: {reason}", flush=True)
    return ok


async def notify_urgent(text: str, session_id: str = "") -> bool:
    return await notify_feishu(text, level="urgent", session_id=session_id)


async def send_test_message() -> tuple[bool, str]:
    """后台「测试发送」按钮用。"""
    payload = {
        "msg_type": "text",
        "content": {"text": "【CV_Bot】测试消息 — 收到即代表飞书配置正常 ✅"},
    }
    return await _send(payload)