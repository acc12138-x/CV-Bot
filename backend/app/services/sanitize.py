# -*- coding: utf-8 -*-
"""后端兜底消毒。前端 DOMPurify 是主防线，这里只做一层保险。"""
import bleach

ALLOWED_TAGS = [
    "p","br","strong","em","code","pre","blockquote",
    "ul","ol","li","a","h1","h2","h3","h4","hr","table",
    "thead","tbody","tr","th","td","span",
]
ALLOWED_ATTRS = {"a": ["href", "title", "target", "rel"], "*": ["class"]}

def sanitize_markdown(text: str) -> str:
    return bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=["http", "https", "mailto"],
        strip=True,
    )
