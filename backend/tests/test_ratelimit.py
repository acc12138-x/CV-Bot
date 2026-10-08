# -*- coding: utf-8 -*-
from app.middleware.ratelimit import RateLimiter

def test_allow_under_limit():
    rl = RateLimiter(per_minute=5)
    for _ in range(5):
        assert rl.allow("ip:1.1.1.1")

def test_block_over_limit():
    rl = RateLimiter(per_minute=5)
    for _ in range(5):
        rl.allow("ip:1.1.1.1")
    assert not rl.allow("ip:1.1.1.1")

def test_different_keys_isolated():
    rl = RateLimiter(per_minute=3)
    for _ in range(3):
        rl.allow("ip:A")
    assert rl.allow("ip:B")

def test_window_slides():
    import time
    rl = RateLimiter(per_minute=2)
    rl.allow("ip:X")
    rl.allow("ip:X")
    assert not rl.allow("ip:X")
    # 手动把队列头时间挪到 61 秒前
    rl._hits["ip:X"][0] = time.time() - 61
    assert rl.allow("ip:X")