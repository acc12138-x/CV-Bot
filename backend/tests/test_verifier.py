# -*- coding: utf-8 -*-
import pytest
from app.services import facts as facts_module
from app.services.verifier import verify, needs_citation


@pytest.fixture(autouse=True)
def clean_facts():
    """每个测试前重置事实库，避免互相污染。"""
    original = facts_module._facts
    facts_module._facts = {}
    yield
    facts_module._facts = original


def _set_facts(items):
    facts_module._facts = {f["id"]: f for f in items}


# ---------- 引用 ID ----------
def test_valid_citation():
    _set_facts([{"id": "F-020", "topic": "project", "key": "x", "value": "abc"}])
    ok, err = verify("我做过这个 [F-020]")
    assert ok, err


def test_invalid_citation():
    ok, err = verify("我用过 [F-999] 技术")
    assert not ok
    assert "F-999" in err


# ---------- URL ----------
def test_fabricated_url_rejected():
    ok, err = verify("我的 GitHub 是 https://github.com/fake/xxx")
    assert not ok
    assert "编造" in err or "链接" in err


def test_real_url_accepted():
    _set_facts([{"id": "F-003", "topic": "basic", "key": "github", "value": "https://github.com/real"}])
    ok, err = verify("参考 https://github.com/real [F-003]")
    assert ok, err


# ---------- ≥4 位数字 ----------
def test_large_number_not_in_facts():
    _set_facts([{"id": "F-001", "topic": "basic", "key": "name", "value": "张三"}])
    ok, err = verify("我在 2024 年加入 [F-001]")
    assert not ok
    assert "2024" in err


def test_large_number_in_facts():
    _set_facts([{"id": "F-001", "topic": "basic", "key": "year", "value": "2024"}])
    ok, err = verify("我在 2024 年加入 [F-001]")
    assert ok, err


def test_small_number_not_checked():
    """3 位及以下数字不验证（避免误杀）。"""
    _set_facts([{"id": "F-001", "topic": "basic", "key": "name", "value": "张三"}])
    ok, err = verify("我做过 3 个项目 [F-001]")
    assert ok, err


def test_multiple_large_numbers_one_missing():
    _set_facts([{"id": "F-001", "topic": "basic", "key": "value", "value": "2024"}])
    ok, err = verify("我在 2024 和 2023 都做过 [F-001]")
    assert not ok
    assert "2023" in err


# ---------- 寒暄 ----------
def test_no_citation_ok():
    ok, err = verify("你好，请问有什么可以帮您？")
    assert ok


def test_needs_citation_short():
    assert not needs_citation("你好")


def test_needs_citation_long():
    assert needs_citation("我做过很多项目，其中最有代表性的是 CV_Bot，它采用了 FastAPI 和 React 构建")