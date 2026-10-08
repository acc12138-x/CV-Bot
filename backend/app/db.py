# -*- coding: utf-8 -*-
import aiosqlite
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from app.config import settings

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ip           TEXT,
    ua           TEXT,
    mode         TEXT DEFAULT 'ai',
    admin_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    tokens     INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    event_type TEXT NOT NULL,
    payload    TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    level      TEXT NOT NULL,
    reason     TEXT,
    sent       INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_usage (
    day        TEXT PRIMARY KEY,
    tokens     INTEGER DEFAULT 0,
    cost_cny   REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_auth (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token      TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
"""

def _db_file() -> str:
    p = Path(settings.db_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)

async def init_db():
    async with aiosqlite.connect(_db_file()) as db:
        await db.executescript(SCHEMA)
        for alter in [
            "ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'ai'",
            "ALTER TABLE sessions ADD COLUMN admin_seen_at TEXT",
        ]:
            try:
                await db.execute(alter)
                await db.commit()
            except Exception:
                pass
        await db.commit()

async def save_message(session_id: str, role: str, content: str, tokens: int = 0):
    now = _now()
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO messages(session_id, role, content, tokens, created_at) VALUES (?,?,?,?,?)",
            (session_id, role, content, tokens, now),
        )
        await db.execute(
            "INSERT INTO sessions(session_id, created_at, last_seen_at) VALUES (?,?,?) "
            "ON CONFLICT(session_id) DO UPDATE SET last_seen_at=excluded.last_seen_at",
            (session_id, now, now),
        )
        await db.commit()

async def get_history(session_id: str) -> list[dict]:
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute(
            "SELECT role, content, created_at FROM messages WHERE session_id=? ORDER BY id",
            (session_id,),
        )
        rows = await cur.fetchall()
    return [{"role": r[0], "content": r[1], "created_at": r[2]} for r in rows]

async def delete_session(session_id: str) -> int:
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
        n = cur.rowcount
        await db.execute("DELETE FROM sessions WHERE session_id=?", (session_id,))
        await db.commit()
    return n

async def log_event(session_id: str, event_type: str, payload: str = ""):
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO events(session_id, event_type, payload, created_at) VALUES (?,?,?,?)",
            (session_id, event_type, payload, _now()),
        )
        await db.commit()

async def add_daily_usage(tokens: int, cost_cny: float):
    day = date.today().isoformat()
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO daily_usage(day, tokens, cost_cny) VALUES (?,?,?) "
            "ON CONFLICT(day) DO UPDATE SET tokens=tokens+excluded.tokens, cost_cny=cost_cny+excluded.cost_cny",
            (day, tokens, cost_cny),
        )
        await db.commit()

async def get_daily_cost() -> float:
    day = date.today().isoformat()
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT cost_cny FROM daily_usage WHERE day=?", (day,))
        row = await cur.fetchone()
    return float(row[0]) if row else 0.0

# ==================== site_config KV ====================
async def get_config_raw(key: str) -> str | None:
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT value FROM site_config WHERE key=?", (key,))
        row = await cur.fetchone()
    return row[0] if row else None

async def set_config_raw(key: str, value: str):
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO site_config(key, value) VALUES (?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )
        await db.commit()

# ==================== 接管相关 ====================
async def get_mode(session_id: str) -> str:
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT mode FROM sessions WHERE session_id=?", (session_id,))
        row = await cur.fetchone()
    return row[0] if row and row[0] else "ai"

async def set_mode(session_id: str, mode: str):
    now = _now()
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO sessions(session_id, created_at, last_seen_at, mode) VALUES (?,?,?,?) "
            "ON CONFLICT(session_id) DO UPDATE SET mode=excluded.mode, last_seen_at=excluded.last_seen_at",
            (session_id, now, now, mode),
        )
        await db.commit()

async def mark_session_seen(session_id: str):
    """管理员打开这个会话，标记为已读。"""
    now = _now()
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "UPDATE sessions SET admin_seen_at=? WHERE session_id=?",
            (now, session_id),
        )
        await db.commit()

async def list_all_sessions(limit: int = 200) -> list[dict]:
    """按最后活动时间倒序，附带未读消息数。"""
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute(
            """
            SELECT s.session_id, s.mode, s.created_at, s.last_seen_at, s.admin_seen_at,
                   (SELECT content FROM messages WHERE session_id=s.session_id ORDER BY id DESC LIMIT 1),
                   (SELECT role    FROM messages WHERE session_id=s.session_id ORDER BY id DESC LIMIT 1),
                   (SELECT COUNT(*) FROM messages WHERE session_id=s.session_id),
                   (SELECT COUNT(*) FROM messages
                     WHERE session_id=s.session_id
                       AND role='user'
                       AND (s.admin_seen_at IS NULL OR created_at > s.admin_seen_at))
            FROM sessions s
            ORDER BY s.last_seen_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cur.fetchall()
    return [
        {
            "session_id": r[0],
            "mode": r[1] or "ai",
            "created_at": r[2],
            "last_seen_at": r[3],
            "last_message": (r[5] or "")[:140],
            "last_role": r[6] or "",
            "message_count": r[7],
            "unread_count": r[8],
        }
        for r in rows
    ]

async def list_active_sessions(minutes: int = 60, limit: int = 100) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute(
            """
            SELECT s.session_id, s.mode, s.last_seen_at,
                   (SELECT content FROM messages WHERE session_id=s.session_id ORDER BY id DESC LIMIT 1),
                   (SELECT role    FROM messages WHERE session_id=s.session_id ORDER BY id DESC LIMIT 1),
                   (SELECT COUNT(*) FROM messages WHERE session_id=s.session_id)
            FROM sessions s
            WHERE s.last_seen_at >= ?
            ORDER BY s.last_seen_at DESC
            LIMIT ?
            """,
            (cutoff, limit),
        )
        rows = await cur.fetchall()
    return [
        {
            "session_id": r[0],
            "mode": r[1] or "ai",
            "last_seen_at": r[2],
            "last_message": r[3] or "",
            "last_role": r[4] or "",
            "message_count": r[5],
        }
        for r in rows
    ]

# ==================== 管理员鉴权 ====================
import hashlib, secrets as _secrets

PBKDF2_ITER = 200_000
SESSION_DAYS = 7


def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITER,
    )
    return dk.hex()


async def init_admin_auth(initial_password: str):
    """首次启动时设置初始密码；已有密码则不动。"""
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT COUNT(*) FROM admin_auth WHERE id=1")
        exists = (await cur.fetchone())[0] > 0
        if exists:
            return
        salt = _secrets.token_hex(16)
        h = _hash_password(initial_password, salt)
        await db.execute(
            "INSERT INTO admin_auth(id, password_salt, password_hash, updated_at) VALUES (1, ?, ?, ?)",
            (salt, h, _now()),
        )
        await db.commit()


async def verify_admin_password(password: str) -> bool:
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute("SELECT password_salt, password_hash FROM admin_auth WHERE id=1")
        row = await cur.fetchone()
    if not row:
        return False
    salt, stored = row
    return _hash_password(password, salt) == stored


async def set_admin_password(new_password: str):
    salt = _secrets.token_hex(16)
    h = _hash_password(new_password, salt)
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO admin_auth(id, password_salt, password_hash, updated_at) VALUES (1, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET password_salt=excluded.password_salt, "
            "password_hash=excluded.password_hash, updated_at=excluded.updated_at",
            (salt, h, _now()),
        )
        # 改密码后清掉所有 session（强制重新登录）
        await db.execute("DELETE FROM admin_sessions")
        await db.commit()


async def create_admin_session() -> str:
    token = _secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(days=SESSION_DAYS)).isoformat()
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute(
            "INSERT INTO admin_sessions(token, created_at, expires_at) VALUES (?, ?, ?)",
            (token, now.isoformat(), expires),
        )
        # 顺手清理过期 session
        await db.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (now.isoformat(),))
        await db.commit()
    return token


async def check_admin_session(token: str) -> bool:
    if not token:
        return False
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_db_file()) as db:
        cur = await db.execute(
            "SELECT 1 FROM admin_sessions WHERE token=? AND expires_at > ?",
            (token, now),
        )
        row = await cur.fetchone()
    return row is not None


async def revoke_admin_session(token: str):
    if not token:
        return
    async with aiosqlite.connect(_db_file()) as db:
        await db.execute("DELETE FROM admin_sessions WHERE token=?", (token,))
        await db.commit()