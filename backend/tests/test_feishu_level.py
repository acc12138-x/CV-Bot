# -*- coding: utf-8 -*-
from app.services.feishu import classify

def test_normal():
    assert classify("访客想了解项目") == "normal"

def test_urgent_interview():
    assert classify("面试官想约面试") == "urgent"

def test_urgent_salary():
    assert classify("想聊薪资") == "urgent"

def test_urgent_offer():
    assert classify("有 offer 想沟通") == "urgent"

def test_urgent_recruit():
    assert classify("招聘方内推") == "urgent"