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

_cancel_events: dict[str, asyncio.Event] = {}
_sem = asyncio.Semaphore(settings.llm_concurrency)

FALLBACK = "这个我不太确定，稍后可以由本人来确认。"


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


async def _notify_transfer(session_id: str, user_msg: str):
    """AI 检测到转人工意图 → 发飞书通知。"""
    try:
        from app.services.feishu import classify
        level = await classify(user_msg)
        text = (
            f"会话：{session_id}\n"
            f"触发：AI 识别到转人工意图\n"
            f"访客消息：{user_msg[:120]}\n"
            f"级别：{'加急' if level == 'urgent' else '普通'}"
        )
        await notify_feishu(text, level=level, session_id=session_id)
        await log_event(session_id, "auto_transfer", f"level={level}")
    except Exception as e:
        print(f"[transfer notify error] {e}", flush=True)


@router.post("/chat")
async def chat(req: Request):
    ip = req.client.host if req.client else "unknown"
    if not allow_ip(ip):
        return {"error": "rate_limited", "message": "请求过于频繁，请稍后再试"}

    body = await req.json()
    session_id = body.get("session_id") or str(uuid.uuid4())

    if not allow_session(session_id):
        return {"error": "rate_limited", "message": "当前会话请求过于频繁，请稍后再试"}

    user_msg = (body.get("message") or "").strip()
    if not user_msg:
        return {"error": "empty message"}

    await save_message(session_id, "user", user_msg)
    await log_event(session_id, "user_message", user_msg[:200])
    await hub.publish(session_id, {"type": "user_echo", "content": user_msg})

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
        usage = {"prompt_tokens": 0, "completion_tokens": 0}
        retried = False
        transfer_triggered = False
        try:
            async with _sem:
                history = await get_history(session_id)
                msgs = [{"role": h["role"], "content": h["content"]} for h in history][-12:]

                async for delta, u in stream_chat(msgs, cancel_event=cancel_evt):
                    # 检测标记：分块流式时 [[TRANSFER]] 可能跨 chunk
                    full += delta
                    usage = u or usage
                    # 只在"还没输出到标记"时发给前端
                    if TRANSFER_MARK not in full:
                        yield sse({"type": "delta", "content": delta})
                    else:
                        # 命中标记后停止向用户输出剩余字符
                        pass

            if cancel_evt.is_set():
                yield sse({"type": "cancelled"})
                await save_message(session_id, "assistant", full + "\n\n（已被用户打断）")
                return

            # 从最终内容里剥掉标记 + 前面的空行
            clean = full.replace(TRANSFER_MARK, "").rstrip()
            if TRANSFER_MARK in full:
                transfer_triggered = True
                # 通知飞书：先 yield 给前端，后台任务异步执行
                yield sse({"type": "transfer"})
                asyncio.create_task(_notify_transfer(session_id, user_msg))

            ok, err = verify(clean)
            if not ok:
                await log_event(session_id, "verify_failed_first", err)
                yield sse({"type": "warn", "content": "回答可能不准确，正在校准…"})
                yield sse({"type": "reset"})

                retry_msgs = msgs + [
                    {"role": "assistant", "content": clean},
                    {"role": "user", "content": (
                        f"你的上一个回答违反了规则：{err}。"
                        "请严格只基于事实库重新回答。不允许出现事实库以外的任何链接、数字、公司名、时间。"
                    )},
                ]
                full2 = ""
                async for delta, u in stream_chat(retry_msgs, cancel_event=cancel_evt):
                    if TRANSFER_MARK not in full2:
                        full2 += delta
                        yield sse({"type": "delta", "content": delta})

                clean2 = full2.replace(TRANSFER_MARK, "").rstrip()
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

            yield sse({
                "type": "done",
                "usage": usage,
                "retried": retried,
                "transfer": transfer_triggered,
            })

        except Exception as e:
            print("\n========== LLM ERROR ==========", flush=True)
            print(f"type: {type(e).__name__}", flush=True)
            print(f"msg : {e}", flush=True)
            traceback.print_exc()
            print("===============================\n", flush=True)
            await log_event(session_id, "llm_error", f"{type(e).__name__}: {e}"[:300])
            yield sse({"type": "error", "content": "服务暂时不可用，稍后再试或由本人来回复您。"})
        finally:
            _cancel_events.pop(session_id, None)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def get_cancel_event(session_id: str) -> asyncio.Event | None:
    return _cancel_events.get(session_id)