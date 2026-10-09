# -*- coding: utf-8 -*-
import json, uuid, asyncio, traceback
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.db import (
    save_message, get_history, add_daily_usage, get_daily_cost, log_event, get_mode,
)
from app.services.llm import stream_chat, estimate_cost, TRANSFER_MARK
from app.services.verifier import verify
from app.services.sanitize import sanitize_markdown
from app.services.feishu import notify_feishu
from app.services.hub import hub
from app.middleware.ratelimit import allow_ip, allow_session, init_limiter

router = APIRouter()
init_limiter(settings.rate_limit_per_ip_per_min)

_cancel_events = {}
_sem = asyncio.Semaphore(settings.llm_concurrency)

FALLBACK = "这个我不太确定，稍后可以由本人来确认。"

VIEW_VERBS = ("看", "查", "打开", "展示", "浏览", "瞧")
DOWNLOAD_VERBS = ("下载", "发我", "发一下", "发份", "给我", "要", "拿", "获取")

# 转人工前缀（不完整的也拦）
TRANSFER_PREFIX = "[[TRANS"
# 缓冲：最后 N 个字符不发送，等确认不是标记再发
TAIL_BUFFER = 12


def _check_resume_intent(msg):
    m = (msg or "").strip()
    if not m or len(m) > 40:
        return None
    has_resume = ("简历" in m) or ("resume" in m.lower())
    if not has_resume:
        return None
    has_download = any(v in m for v in DOWNLOAD_VERBS)
    has_view = any(v in m for v in VIEW_VERBS)
    if has_download:
        return (
            "download",
            "/api/site/resume",
            "好的，简历下载链接在这儿 👇\n\n**📥 [点此下载简历 PDF](/api/site/resume)**",
        )
    if has_view:
        return (
            "view",
            "/resume",
            "简历在这儿 👇\n\n**📄 [打开在线简历](/resume)**\n\n也可以直接下载 PDF：[点此下载](/api/site/resume)",
        )
    if m in ("简历", "简历呢", "你的简历", "简历在哪"):
        return (
            "view",
            "/resume",
            "简历在这儿 👇\n\n**📄 [打开在线简历](/resume)**",
        )
    return None


def sse(obj):
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


def _has_transfer_prefix(text):
    """只要出现 [[TRANS 开头就认为在打标记。"""
    return TRANSFER_PREFIX in text or "[[TRANSFER" in text


async def _notify_transfer(session_id, user_msg):
    try:
        from app.services.feishu import classify
        level = await classify(user_msg)
        text = (
            "会话：" + session_id + "\n"
            "触发：AI 识别到转人工意图\n"
            "访客消息：" + user_msg[:120] + "\n"
            "级别：" + ("加急" if level == "urgent" else "普通")
        )
        await notify_feishu(text, level=level, session_id=session_id)
        await log_event(session_id, "auto_transfer", "level=" + level)
    except Exception as e:
        print("[transfer notify error] " + str(e), flush=True)


@router.post("/chat")
async def chat(req: Request):
    ip = req.client.host if req.client else "unknown"
    if not allow_ip(ip):
        return {"error": "rate_limited", "message": "请求过于频繁，请稍后再试"}

    body = await req.json()
    session_id = body.get("session_id") or str(uuid.uuid4())
    if not allow_session(session_id):
        return {"error": "rate_limited", "message": "当前会话请求过于频繁"}

    user_msg = (body.get("message") or "").strip()
    if not user_msg:
        return {"error": "empty message"}

    await save_message(session_id, "user", user_msg)
    await log_event(session_id, "user_message", user_msg[:200])
    await hub.publish(session_id, {"type": "user_echo", "content": user_msg})

    intent = _check_resume_intent(user_msg)
    if intent is not None:
        action, url, reply_md = intent
        await save_message(session_id, "assistant", reply_md)
        await log_event(session_id, "resume_intent", action + ":" + url)

        async def gen_intent():
            yield sse({"type": "start", "session_id": session_id})
            yield sse({"type": "delta", "content": reply_md})
            yield sse({"type": "intent", "action": action, "url": url})
            yield sse({"type": "done", "usage": {}, "intent": action})

        return StreamingResponse(
            gen_intent(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    mode = await get_mode(session_id)
    if mode == "human":

        async def gen_human():
            yield sse({"type": "start", "session_id": session_id, "mode": "human"})
            yield sse({"type": "done", "usage": {}, "mode": "human"})

        return StreamingResponse(
            gen_human(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    cost_today = await get_daily_cost()
    if cost_today >= settings.daily_budget_cny:
        return {"error": "budget_exceeded", "message": "今日服务额度已用完"}

    cancel_evt = asyncio.Event()
    _cancel_events[session_id] = cancel_evt

    async def gen():
        yield sse({"type": "start", "session_id": session_id})
        full = ""
        sent = ""  # 已经发给前端的部分
        usage = {"prompt_tokens": 0, "completion_tokens": 0}
        retried = False
        transfer_triggered = False
        stopped_by_transfer = False

        try:
            async with _sem:
                history = await get_history(session_id)
                msgs = []
                for h in history:
                    role = h.get("role", "")
                    # 人工回复（human）对 LLM 来说就是 assistant
                    if role == "human":
                        role = "assistant"
                    # 只保留 LLM 认识的 role
                    if role not in ("user", "assistant", "system", "tool"):
                        continue
                    msgs.append({"role": role, "content": h.get("content", "")})
                msgs = msgs[-12:]

                async for delta, u in stream_chat(msgs, cancel_event=cancel_evt):
                    full += delta
                    usage = u or usage

                    # 一旦出现 [[TRANS 前缀，停止向用户输出
                    if _has_transfer_prefix(full):
                        stopped_by_transfer = True
                        continue

                    # 用"尾缓冲"策略：
                    # 只发送 full 里已经确定不是标记开头的部分
                    # 保留最后 TAIL_BUFFER 个字符等下一轮确认
                    if len(full) > TAIL_BUFFER:
                        safe_len = len(full) - TAIL_BUFFER
                        if safe_len > len(sent):
                            chunk = full[len(sent):safe_len]
                            sent = full[:safe_len]
                            if chunk:
                                yield sse({"type": "delta", "content": chunk})

            if cancel_evt.is_set():
                # 把缓冲区剩余发出去
                if len(full) > len(sent) and not stopped_by_transfer:
                    tail = full[len(sent):]
                    if tail:
                        yield sse({"type": "delta", "content": tail})
                yield sse({"type": "cancelled"})
                await save_message(session_id, "assistant", full + "\n\n（已被用户打断）")
                return

            # 流结束：把缓冲区的剩余字符发出去（前提：不是标记）
            clean = full.replace(TRANSFER_MARK, "").replace("[[TRANSFER]]", "").replace("[[TRANSFER", "").rstrip()

            if transfer_triggered or _has_transfer_prefix(full):
                stopped_by_transfer = True

            # 发送剩余部分（clean 去掉标记后的尾部）
            if not stopped_by_transfer:
                # full 里没有标记，剩余全部安全
                if len(clean) > len(sent):
                    tail = clean[len(sent):]
                    if tail:
                        yield sse({"type": "delta", "content": tail})
            else:
                # 有标记，只发送标记之前的部分
                # 计算 sent 到标记位置的内容
                mark_pos = len(full)
                for p in ["[[TRANS", "[[TRANSFER", "[[TRANSFER]]"]:
                    idx = full.find(p)
                    if idx >= 0 and idx < mark_pos:
                        mark_pos = idx
                before_mark = full[:mark_pos].rstrip()
                if len(before_mark) > len(sent):
                    tail = before_mark[len(sent):]
                    if tail:
                        yield sse({"type": "delta", "content": tail})
                transfer_triggered = True
                yield sse({"type": "transfer"})
                asyncio.create_task(_notify_transfer(session_id, user_msg))

            clean = full
            for p in ["[[TRANSFER]]", "[[TRANSFER", "[[TRANS"]:
                clean = clean.replace(p, "")
            clean = clean.rstrip()

            ok, err = verify(clean)
            if not ok:
                await log_event(session_id, "verify_failed_first", err)
                yield sse({"type": "warn", "content": "回答可能不准确，正在校准…"})
                yield sse({"type": "reset"})
                retry_msgs = msgs + [
                    {"role": "assistant", "content": clean},
                    {"role": "user", "content": "你的上一个回答违反了规则：" + err + "。请严格只基于事实库重新回答。"},
                ]
                full2 = ""
                sent2 = ""
                async for delta, u in stream_chat(retry_msgs, cancel_event=cancel_evt):
                    full2 += delta
                    if _has_transfer_prefix(full2):
                        continue
                    if len(full2) > TAIL_BUFFER:
                        safe_len = len(full2) - TAIL_BUFFER
                        if safe_len > len(sent2):
                            chunk = full2[len(sent2):safe_len]
                            sent2 = full2[:safe_len]
                            if chunk:
                                yield sse({"type": "delta", "content": chunk})

                clean2 = full2
                for p in ["[[TRANSFER]]", "[[TRANSFER", "[[TRANS"]:
                    clean2 = clean2.replace(p, "")
                clean2 = clean2.rstrip()

                # 发最后一段
                if len(clean2) > len(sent2):
                    tail = clean2[len(sent2):]
                    if tail:
                        yield sse({"type": "delta", "content": tail})

                ok2, err2 = verify(clean2)
                if not ok2:
                    await log_event(session_id, "verify_failed_second", err2)
                    clean = FALLBACK
                    yield sse({"type": "replace", "content": FALLBACK})
                else:
                    clean = clean2
                    retried = True

            safe = sanitize_markdown(clean)
            await save_message(session_id, "assistant", safe, tokens=usage.get("completion_tokens", 0))
            cost = estimate_cost(usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
            await add_daily_usage(usage.get("completion_tokens", 0), cost)
            yield sse({"type": "done", "usage": usage, "retried": retried, "transfer": transfer_triggered})

        except Exception as e:
            print("\n========== LLM ERROR ==========", flush=True)
            print("type: " + type(e).__name__, flush=True)
            print("msg : " + str(e), flush=True)
            traceback.print_exc()
            print("===============================\n", flush=True)
            await log_event(session_id, "llm_error", (type(e).__name__ + ": " + str(e))[:300])
            yield sse({"type": "error", "content": "服务暂时不可用"})
        finally:
            _cancel_events.pop(session_id, None)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


def get_cancel_event(session_id):
    return _cancel_events.get(session_id)