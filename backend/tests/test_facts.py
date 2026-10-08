# -*- coding: utf-8 -*-
from app.services.facts import load_facts, all_facts, public_facts, contact_fields, get_fact

def setup_module():
    load_facts()

def test_load_ok():
    assert len(all_facts()) > 0

def test_ids_unique():
    ids = [f["id"] for f in all_facts()]
    assert len(ids) == len(set(ids)), "事实 ID 有重复"

def test_ids_format():
    import re
    for f in all_facts():
        assert re.match(r"^F-\d{3}$", f["id"]), f"ID 格式错误: {f['id']}"

def test_public_flag_is_bool():
    for f in all_facts():
        assert isinstance(f.get("public", True), bool), f"{f['id']} public 不是 bool"

def test_contact_not_public():
    for f in contact_fields():
        assert f.get("public") is False

def test_get_fact():
    fid = all_facts()[0]["id"]
    assert get_fact(fid) is not None
    assert get_fact("F-000") is None