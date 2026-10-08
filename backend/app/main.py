# -*- coding: utf-8 -*-
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.services.facts import load_facts
from app.routers import chat, cancel, session, contact, site, admin, events

def _log(msg: str, t0: float):
    print(f"[startup] {msg}  ({time.time() - t0:.2f}s)", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.time()
    print("[startup] begin", flush=True)

    print("[startup] load_facts...", flush=True)
    load_facts()
    _log("load_facts done", t0)

    print("[startup] init_db...", flush=True)
    await init_db()
    _log("init_db done", t0)

    print("[startup] init_admin_auth...", flush=True)
    from app.db import init_admin_auth
    await init_admin_auth(settings.admin_token or "admin")
    _log("init_admin_auth done", t0)

    print("[startup] site_config defaults...", flush=True)
    from app.services import site_config
    for k in site_config.VALID_KEYS:
        print(f"[startup]   get_config({k})...", flush=True)
        await site_config.get_config(k)
    _log("site_config done", t0)

    print("[startup] ready", flush=True)
    yield

    print("[shutdown] bye", flush=True)


app = FastAPI(title="CV_Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path("./static")
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(chat.router,    prefix="/api")
app.include_router(cancel.router,  prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(site.router,    prefix="/api")
app.include_router(admin.auth_router, prefix="/api")
app.include_router(admin.router,      prefix="/api")
app.include_router(events.router,  prefix="/api")

@app.get("/")
async def root():
    return {"app": "CV_Bot", "status": "running", "docs": "/docs", "health": "/health"}

@app.get("/health")
async def health():
    return {"ok": True, "model": settings.deepseek_model, "app": "CV_Bot"}