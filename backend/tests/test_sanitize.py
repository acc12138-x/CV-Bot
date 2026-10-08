# -*- coding: utf-8 -*-
"""
后端消毒只针对 HTML。
markdown → HTML 由前端 marked 完成，XSS 防护由前端 DOMPurify 完成。
后端 bleach 是二次兜底，只兜 HTML 里的危险标签/属性/协议。
"""
from app.services.sanitize import sanitize_markdown

def test_script_removed():
    out = sanitize_markdown("<script>alert(1)</script>hello")
    assert "<script>" not in out
    assert "hello" in out

def test_onerror_removed():
    out = sanitize_markdown('<img src=x onerror="alert(1)">')
    assert "onerror" not in out

def test_javascript_url_in_html_removed():
    # 直接测 HTML：<a href="javascript:...">
    out = sanitize_markdown('<a href="javascript:alert(1)">click</a>')
    assert "javascript:" not in out

def test_allowed_html_tags_kept():
    out = sanitize_markdown("<strong>bold</strong> and <code>code</code>")
    assert "<strong>" in out
    assert "<code>" in out

def test_iframe_removed():
    out = sanitize_markdown('<iframe src="http://evil.com"></iframe>')
    assert "<iframe" not in out

def test_link_kept():
    out = sanitize_markdown('<a href="https://example.com">官网</a>')
    assert "https://example.com" in out

def test_style_attr_removed():
    out = sanitize_markdown('<p style="background:url(javascript:alert(1))">x</p>')
    assert "javascript:" not in out