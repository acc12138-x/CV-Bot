# -*- coding: utf-8 -*-
import yaml
from pathlib import Path
from app.config import settings

_facts: dict[str, dict] = {}

def load_facts():
    global _facts
    p = Path(settings.facts_path)
    if not p.exists():
        _facts = {}
        return
    raw = yaml.safe_load(p.read_text(encoding="utf-8-sig")) or []
    _facts = {f["id"]: f for f in raw if "id" in f}

def save_facts(facts: list[dict]) -> None:
    """写回 YAML 文件并刷新内存。"""
    p = Path(settings.facts_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        yaml.safe_dump(facts, allow_unicode=True, sort_keys=False, default_flow_style=False),
        encoding="utf-8",
    )
    load_facts()

def get_fact(fid: str) -> dict | None:
    return _facts.get(fid)

def all_facts() -> list[dict]:
    return list(_facts.values())

def public_facts() -> list[dict]:
    return [f for f in _facts.values() if f.get("public", True)]

def facts_as_system_prompt() -> str:
    lines = ["以下是关于本人的全部事实，回答必须只基于这些事实："]
    for f in public_facts():
        lines.append(f"[{f['id']}] {f.get('topic','')}/{f.get('key','')}: {f.get('value','')}")
    return "\n".join(lines)

def contact_fields() -> list[dict]:
    return [f for f in _facts.values() if f.get("topic") == "contact" and f.get("public") is False]