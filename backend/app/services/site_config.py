# -*- coding: utf-8 -*-
"""站点配置 KV。"""
import json
from pathlib import Path
from app.db import get_config_raw, set_config_raw


DEFAULT_PROFILE = {
    "name": "你的名字",
    "title": "后端 / AI 应用开发",
    "tagline": "用 Python 构建可靠、可交付的系统",
    "intro": "我专注于后端与 AI 应用开发。",
    "links": [
        {"label": "GitHub", "href": "https://github.com/你的用户名"},
    ],
    "chatButtonText": "和 CV_Bot 聊聊",
    "resumeFile": "resume.pdf",
    "resumeLabel": "在线简历",
}

DEFAULT_HERO = {
    "videoUrl": "",
    "posterUrl": "",
    "badgeText": "在线 · 随时可以问我任何问题",
    "badgeHref": "",
    "headlineLine1": "你好，请给我一分钟",
    "headlineLine2": "我来帮你了解他",
    "backedByLabel": "我会这些",
    "backedByItems": ["Python", "FastAPI", "React", "TypeScript", "DeepSeek", "Docker"],
    "primaryCtaText": "和 CV_Bot 聊聊",
    "chatWelcome": (
        "👋 你好，我是 **CV_Bot**，这份简历的 AI 助手。\n\n"
        "我可以帮你快速了解这位同学的：\n"
        "- 🚀 **项目经历** —— 做过什么、怎么设计的\n"
        "- 🛠 **技术栈** —— 用过的语言、框架、工具\n"
        "- 🧩 **工程能力** —— 遇到过什么问题、怎么解的\n"
        "- 📄 **更多背景** —— 教育、经历、联系方式\n\n"
        "想从哪儿开始？直接问我，或从下面挑一个 👇"
    ),
    "chatExamples": [
        "你做过哪些项目？",
        "技术栈是什么？",
        "有没有 GitHub 或作品链接？",
        "做过 AI 相关的东西吗？",
    ],
}

DEFAULT_PROJECTS = [
    {
        "name": "点餐系统",
        "subtitle": "全栈应用",
        "desc": "点餐、结账、后台管理的完整闭环。React + 后端服务，Docker 部署，独立子域名对外可访问。",
        "tags": ["React", "Docker", "全栈", "Nginx"],
        "accent": "#f59e0b",
        "status": "在线",
        "link": "https://tsx.你的域名",
        "mediaUrl": "",
        "chatWelcome": (
            "🍽 **点餐系统**\n\n"
            "这是一个从点餐、结账到后台管理的完整闭环 —— "
            "React + 后端服务，Docker 部署上线，独立子域名对外可访问。\n\n"
            "想了解哪一块？👇"
        ),
        "chatExamples": [
            "点餐系统的技术栈是什么？",
            "数据库是怎么设计的？",
            "后台管理有哪些功能？",
            "开发时遇到过什么坑？",
        ],
    },
    {
        "name": "售后知识库 Agent",
        "subtitle": "企业级 Agent 平台",
        "desc": "面向企业售后场景的知识库 Agent。RAG 检索 + 21 个权限点 + 飞书通知，多角色权限体系。",
        "tags": ["FastAPI", "React", "RAG", "权限系统", "飞书"],
        "accent": "#10b981",
        "status": "在线",
        "link": "https://agent.你的域名",
        "mediaUrl": "",
        "chatWelcome": (
            "🤖 **企业售后知识库 Agent**\n\n"
            "面向企业售后场景的 Agent 平台：**RAG 检索 + 21 个权限点 + 飞书通知**，"
            "一套完整的多角色权限体系。\n\n"
            "想深入哪一块？👇"
        ),
        "chatExamples": [
            "RAG 检索是怎么做的？",
            "权限系统怎么设计的？",
            "飞书通知接入了哪些场景？",
            "为什么选 RAG 而不是长上下文？",
        ],
    },
    {
        "name": "CV_Bot",
        "subtitle": "简历机器人",
        "desc": "你现在看到的这个。FastAPI + React + DeepSeek，不做 RAG，全量注入事实库，配确定性验证器防幻觉。",
        "tags": ["FastAPI", "React", "DeepSeek", "SSE"],
        "accent": "#4f46e5",
        "status": "在线",
        "link": "",
        "mediaUrl": "",
        "chatWelcome": (
            "💬 你现在正在用 **CV_Bot** 本身。\n\n"
            "它是用 FastAPI + React + DeepSeek 做的一个**会对话的简历**。"
            "两个设计要点：**不做 RAG**（语料太小没必要），"
            "**全量注入事实库 + 确定性验证器**挡住模型编造。\n\n"
            "想聊哪一块？👇"
        ),
        "chatExamples": [
            "为什么不做 RAG？",
            "验证器是怎么防幻觉的？",
            "SSE 流式是怎么实现的？",
            "这个项目的技术难点在哪？",
        ],
    },
]

DEFAULT_SKILLS = [
    {"group": "后端", "items": ["Python", "FastAPI", "SQLite", "Docker", "REST"]},
    {"group": "前端", "items": ["React", "TypeScript", "Vite", "Tailwind"]},
    {"group": "AI", "items": ["LLM 应用", "SSE 流式", "Prompt 工程", "防幻觉"]},
    {"group": "工程", "items": ["Git", "Nginx", "Linux", "pytest"]},
]

DEFAULT_RESUME = {
    "pageTitle": "在线简历",
    "downloadLabel": "下载简历",
    "htmlContent": """<h1>你的名字</h1>
<p class="resume-subtitle">后端 / AI 应用开发 · 你的邮箱 · 你的电话</p>

<h2>简介</h2>
<p>专注于后端与 AI 应用开发。做过企业级知识库 Agent、点餐系统，以及你现在看到的这个简历机器人。</p>

<h2>技能</h2>
<ul>
  <li><strong>后端：</strong>Python / FastAPI / SQLite / Docker / REST</li>
  <li><strong>前端：</strong>React / TypeScript / Vite</li>
  <li><strong>AI：</strong>LLM 应用 / SSE 流式 / Prompt 工程 / 防幻觉验证</li>
  <li><strong>工程：</strong>Git / Nginx / Linux / pytest</li>
</ul>

<h2>项目经历</h2>
<h3>CV_Bot · 简历机器人</h3>
<p>FastAPI + React + DeepSeek，不做 RAG，全量注入事实库，配确定性验证器防幻觉。</p>

<h3>企业售后知识库 Agent 平台</h3>
<p>RAG 检索 + 21 个权限点 + 飞书通知，多角色权限体系。</p>

<h3>点餐系统</h3>
<p>React + 后端服务，Docker 部署，独立子域名对外可访问。</p>
""",
}

DEFAULT_EXPERIENCE = {
    "pageTitle": "我的经历",
    "subtitle": "走过的路，做过的选择",
    "mediaUrl": "",
    "items": [
        {
            "year": "2024",
            "title": "CV_Bot 简历机器人",
            "org": "个人项目",
            "desc": "从零搭建一个会对话的简历。FastAPI + React + DeepSeek，一期上线。",
        },
        {
            "year": "2023",
            "title": "企业售后知识库 Agent 平台",
            "org": "公司项目",
            "desc": "负责后端架构，搭建 RAG 检索、权限系统、飞书通知。",
        },
        {
            "year": "2023",
            "title": "点餐系统",
            "org": "个人项目",
            "desc": "React + 后端服务完整闭环，Docker 部署上线。",
        },
        {
            "year": "2022",
            "title": "开始专注后端开发",
            "org": "学习历程",
            "desc": "从 Python 基础入手，逐步进入 Web 后端与 AI 应用方向。",
        },
    ],
}

DEFAULT_FOOTER = {
    "icp": "渝ICP备2026023962号",
    "icpUrl": "https://beian.miit.gov.cn/",
    "copyright": "",
    "extraLinks": [],
}

DEFAULT_SITE = {
    "siteUrl": "http://localhost:5173",
    "notifyLinkEnabled": True,
}

DEFAULT_FEISHU = {
    "webhookUrl": "",
    "urgentKeywords": [
        "合作", "面试", "薪资", "招聘", "offer", "Offer", "OFFER",
        "简历", "约", "内推", "岗位", "入职", "谈",
    ],
    "enabled": True,
}

DEFAULTS = {
    "profile":    DEFAULT_PROFILE,
    "hero":       DEFAULT_HERO,
    "projects":   DEFAULT_PROJECTS,
    "skills":     DEFAULT_SKILLS,
    "resume":     DEFAULT_RESUME,
    "experience": DEFAULT_EXPERIENCE,
    "footer":     DEFAULT_FOOTER,
    "site":       DEFAULT_SITE,
    "feishu":     DEFAULT_FEISHU,
}

VALID_KEYS = set(DEFAULTS.keys())


def _is_valid_media_url(url: str) -> bool:
    if not url:
        return False
    url = url.strip()
    if url.startswith("/static/"):
        name = url[len("/static/"):]
        static_dir = Path(__file__).parent.parent.parent / "static"
        return (static_dir / name).exists()
    if url.startswith("/"):
        return True
    return url.startswith(("http://", "https://"))


def _sanitize_media_field(d: dict, keys: tuple) -> dict:
    if not isinstance(d, dict):
        return d
    for k in keys:
        v = d.get(k, "")
        if v and not _is_valid_media_url(v):
            d[k] = ""
    return d


def _sanitize_projects(projects):
    if not isinstance(projects, list):
        return projects
    for p in projects:
        _sanitize_media_field(p, ("mediaUrl",))
    return projects


def _merge_default(default, stored):
    if isinstance(default, dict) and isinstance(stored, dict):
        out = {}
        for k, dv in default.items():
            if k in stored:
                out[k] = _merge_default(dv, stored[k])
            else:
                out[k] = dv
        for k, sv in stored.items():
            if k not in out:
                out[k] = sv
        return out

    if isinstance(default, list) and isinstance(stored, list):
        if stored and all(isinstance(x, dict) and "name" in x for x in stored):
            default_by_name = {
                d["name"]: d
                for d in default
                if isinstance(d, dict) and "name" in d
            }
            merged = []
            for s in stored:
                d = default_by_name.get(s.get("name", ""))
                merged.append(_merge_default(d, s) if d is not None else s)
            return merged

        if len(default) == len(stored):
            return [_merge_default(d, s) for d, s in zip(default, stored)]

        return stored

    return stored


async def get_config(key: str):
    if key not in VALID_KEYS:
        raise KeyError(key)
    raw = await get_config_raw(key)
    if raw is None:
        await set_config(key, DEFAULTS[key])
        return DEFAULTS[key]
    try:
        stored = json.loads(raw)
    except Exception:
        return DEFAULTS[key]
    merged = _merge_default(DEFAULTS[key], stored)
    if key == "hero":
        merged = _sanitize_media_field(merged, ("videoUrl", "posterUrl"))
    elif key == "projects":
        merged = _sanitize_projects(merged)
    elif key == "experience":
        merged = _sanitize_media_field(merged, ("mediaUrl",))
    return merged


async def set_config(key: str, value):
    if key not in VALID_KEYS:
        raise KeyError(key)
    await set_config_raw(key, json.dumps(value, ensure_ascii=False))


async def get_all():
    out = {}
    for k in DEFAULTS:
        out[k] = await get_config(k)
    return out