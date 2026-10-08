# -*- coding: utf-8 -*-
"""访客事件分发：每个 session 可以挂多个订阅者（页面可能开多个标签）。
   人工发言时 publish 到所有订阅者。"""
import asyncio
from typing import Any

class SessionHub:
    def __init__(self):
        self._subs: dict[str, list[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, session_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subs.setdefault(session_id, []).append(q)
        return q

    async def unsubscribe(self, session_id: str, q: asyncio.Queue):
        async with self._lock:
            lst = self._subs.get(session_id, [])
            if q in lst:
                lst.remove(q)
            if not lst:
                self._subs.pop(session_id, None)

    async def publish(self, session_id: str, event: dict[str, Any]):
        async with self._lock:
            targets = list(self._subs.get(session_id, []))
        for q in targets:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # 慢客户端：丢掉最旧的，塞新的
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except Exception:
                    pass

    def subscriber_count(self, session_id: str) -> int:
        return len(self._subs.get(session_id, []))

hub = SessionHub()