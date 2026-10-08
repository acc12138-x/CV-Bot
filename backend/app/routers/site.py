# -*- coding: utf-8 -*-
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.services import site_config

router = APIRouter()

RESUME_DIR = Path("./data")
RESUME_NAMES = {"resume.pdf": "application/pdf", "resume.docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}

@router.get("/site/profile")
async def get_profile():
    return await site_config.get_config("profile")

@router.get("/site/projects")
async def get_projects():
    return await site_config.get_config("projects")

@router.get("/site/skills")
async def get_skills():
    return await site_config.get_config("skills")

@router.get("/site/all")
async def get_all_site():
    return await site_config.get_all()

@router.get("/site/resume")
async def get_resume():
    for name, mime in RESUME_NAMES.items():
        p = RESUME_DIR / name
        if p.exists():
            return FileResponse(p, media_type=mime, filename=name)
    raise HTTPException(404, "简历文件不存在，请在后台上传")

@router.head("/site/resume")
async def head_resume():
    for name in RESUME_NAMES:
        if (RESUME_DIR / name).exists():
            return {"ok": True, "file": name}
    raise HTTPException(404, "简历文件不存在")