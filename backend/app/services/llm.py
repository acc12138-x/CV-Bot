# -*- coding: utf-8 -*-
import json
import httpx
from app.config import settings
from app.services.facts import facts_as_system_prompt

SYSTEM_TEMPLATE = """你是「CV_Bot」，代表本人回答访客（多为面试官、招聘方）的问题。

【你的职责】
回答关于本人简历、项目经历、技术栈、技能、教育、可公开背景的问题。

【回答规则】
1. 优先基于下面【事实库】回答。事实库里明确没有的具体数字、公司名、时间、链接，不要编，改用：
   "这一块我不太确定，稍后可以由本人来确认。"
2. 涉及技术、项目、经历的回答，尽量附事实 ID，格式如 [F-010]。
3. 链接只能来自事实库原文，绝不自己拼 URL。
4. 与本人简历/项目/技术完全无关的话题，礼貌拉回。
5. 中文回答，简洁专业，单次回答控制在 300 字以内。
6. 不要提"点按钮"、"点击下方"这类界面操作的话术。

【转人工规则 — 重要】
当访客表达以下意图时，你必须在回答的**最后单独一行**输出特殊标记 `[[TRANSFER]]`：
- 想直接联系本人 / 要联系方式 / 约电话 / 加微信
- 合作、面试、招聘、内推、offer 沟通等商务意图
- 提出简历、项目之外的具体业务问题，你确实无法回答
- 明显的不满、投诉、投诉倾向

示例（当访客说"我想和你本人聊聊"）：
「好的，这类问题我处理不了，稍后由本人直接回复你。如果你有简历相关问题我也可以先帮你同步。

[[TRANSFER]]」

当访客只是正常问简历/项目/技术时，**不要**输出 `[[TRANSFER]]`。

【事实库】
{facts}
"""

TRANSFER_MARK = "[[TRANSFER]]"

PRICE_IN  = 1.0 / 1_000_000
PRICE_OUT = 2.0 / 1_000_000


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    return prompt_tokens * PRICE_IN + completion_tokens * PRICE_OUT


async def stream_chat(messages: list[dict], cancel_event=None):
    system = SYSTEM_TEMPLATE.format(facts=facts_as_system_prompt())
    payload = {
        "model": settings.deepseek_model,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": True,
        "temperature": 0.2,
        "max_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }
    usage = {"prompt_tokens": 0, "completion_tokens": 0}

    async with httpx.AsyncClient(timeout=settings.llm_timeout_sec) as client:
        async with client.stream(
            "POST",
            f"{settings.deepseek_base_url}/chat/completions",
            json=payload,
            headers=headers,
        ) as r:
            if r.status_code != 200:
                text = await r.aread()
                raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {text.decode('utf-8', 'ignore')[:400]}")

            async for line in r.aiter_lines():
                if cancel_event is not None and cancel_event.is_set():
                    break
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if obj.get("usage"):
                    usage["prompt_tokens"]     = obj["usage"].get("prompt_tokens", 0)
                    usage["completion_tokens"] = obj["usage"].get("completion_tokens", 0)
                choices = obj.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta", {}).get("content", "")
                if delta:
                    yield delta, usage