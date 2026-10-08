# -*- coding: utf-8 -*-
"""内存限流。单进程 uvicorn 够用。"""
import time
from collections import defaultdict, deque

class RateLimiter:
    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        q = self._hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return False
        q.append(now)
        return True

    def clear(self):
        self._hits.clear()

_rate = RateLimiter(per_minute=20)

def init_limiter(per_minute: int):
    global _rate
    _rate = RateLimiter(per_minute=per_minute)

def reset_limiter():
    _rate.clear()

def allow_ip(ip: str) -> bool:
    return _rate.allow(f"ip:{ip}")

def allow_session(session_id: str) -> bool:
    return _rate.allow(f"sess:{session_id}")