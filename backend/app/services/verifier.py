# -*- coding: utf-8 -*-
"""确定性验证器：模型输出后、返回给用户前，必须跑一遍。

三道检查：
1. 引用 ID（F-0xx）必须真实存在
2. 出现的链接必须来自事实库
3. 出现的 ≥4 位数字（年份、具体编号、大额数字）必须能在事实库找到出处
   —— 小数字（≤3 位）不检查，避免误杀"3 个项目"这类表达

任一不通过 → 返回 False，由 chat.py 决定重写还是降级。
"""
import re
from app.services.facts import get_fact, all_facts

FACT_ID_RE   = re.compile(r"F-\d{3}")
URL_RE       = re.compile(r"https?://[^\s\)\]\>\"']+")
LARGE_NUM_RE = re.compile(r"\b\d{4,}\b")


def _known_urls() -> set[str]:
    urls = set()
    for f in all_facts():
        v = str(f.get("value", ""))
        for u in URL_RE.findall(v):
            urls.add(u.rstrip("/"))
    return urls


def _facts_text() -> str:
    """把所有事实的 value 拼成一个大文本，用于快速子串查找。"""
    parts = []
    for f in all_facts():
        parts.append(str(f.get("value", "")))
    return " ".join(parts)


def _verify_citations(answer: str) -> tuple[bool, str]:
    for fid in FACT_ID_RE.findall(answer):
        if get_fact(fid) is None:
            return False, f"引用了不存在的事实 {fid}"
    return True, ""


def _verify_urls(answer: str) -> tuple[bool, str]:
    known = _known_urls()
    for u in URL_RE.findall(answer):
        if u.rstrip("/") not in known:
            return False, f"编造了链接 {u}"
    return True, ""


def _verify_numbers(answer: str) -> tuple[bool, str]:
    """≥4 位数字必须能在事实库找到。"""
    facts_text = _facts_text()
    nums = set(LARGE_NUM_RE.findall(answer))
    missing = [n for n in nums if n not in facts_text]
    if missing:
        sample = "、".join(missing[:3])
        return False, f"回答里出现了事实库没有的具体数字：{sample}"
    return True, ""


def verify(answer: str) -> tuple[bool, str]:
    for check in (_verify_citations, _verify_urls, _verify_numbers):
        ok, err = check(answer)
        if not ok:
            return False, err
    return True, ""


def needs_citation(answer: str) -> bool:
    """判断一句回答是否需要有事实引用（寒暄类不需要）。"""
    if len(answer) < 30:
        return False
    small_talk = ["你好", "您好", "谢谢", "再见", "不客气"]
    if any(answer.strip().startswith(s) for s in small_talk) and len(answer) < 60:
        return False
    return True