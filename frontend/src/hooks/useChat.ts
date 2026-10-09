import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  cancelStream,
  fetchHistory,
  getSessionId,
  resetSessionId,
  streamChat,
} from "../api";

const MAX_VISIBLE = 50;
const MAX_CHARS = 20000;
const MAX_CACHE = 100;

const DEFAULT_WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "👋 你好，我是 **CV_Bot**，可以帮你了解这位同学。\n\n想从哪儿开始？也可以直接问我任何问题 😊",
};

const cacheKey = (sid: string) => `cvbot_msgs_${sid}`;

function readCache(sid: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(sid));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(sid: string, msgs: ChatMessage[]) {
  try {
    const trimmed = msgs.length > MAX_CACHE ? msgs.slice(-MAX_CACHE) : msgs;
    localStorage.setItem(cacheKey(sid), JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function useChat() {
  const initialSid = getSessionId();
  const [sessionId, setSessionId] = useState<string>(initialSid);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return readCache(initialSid) ?? [DEFAULT_WELCOME];
  });
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [humanMode, setHumanMode] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // ---------- 会话切换：读本地缓存 + 拉后端历史 ----------
  useEffect(() => {
    const cached = readCache(sessionId);
    setMessages(cached ?? [DEFAULT_WELCOME]);

    let alive = true;
    (async () => {
      const hist = await fetchHistory(sessionId);
      if (!alive) return;
      if (hist.length > 0) {
        setMessages([DEFAULT_WELCOME, ...hist]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // ---------- 订阅事件流（接管 / 人工消息）----------
  useEffect(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`/api/session/${sessionId}/events`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        switch (ev.type) {
          case "human_message":
            setMessages((prev) => {
              // 先清掉末尾空的 AI 占位，再追加人工消息
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant" && last.content.trim() === "") {
                next.pop();
              }
              const lastNow = next[next.length - 1];
              if (lastNow && lastNow.role === "human" && lastNow.content === ev.content) {
                return next;
              }
              return [...next, { role: "human", content: ev.content }];
            });
            setHumanMode(true);
            break;
          case "human_takeover":
            setHumanMode(true);
            setPendingTransfer(false);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant" && last.content.trim() === "") {
                next.pop();
              }
              const tip = "📩 已通知本人，稍后由本人亲自回复。";
              const lastNow = next[next.length - 1];
              if (lastNow && lastNow.role === "assistant" && lastNow.content.includes("已通知本人")) {
                return next;
              }
              return [...next, { role: "assistant", content: tip }];
            });
            break;
          case "human_release":
            setHumanMode(false);
            setPendingTransfer(false);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "🤖 已切回 AI 回复。" },
            ]);
            break;
          case "connected":
          case "user_echo":
            break;
          default:
            break;
        }
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      console.warn("[useChat] events SSE disconnected, will retry");
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);

  // ---------- 消息变化 → 写缓存 ----------
  useEffect(() => {
    writeCache(sessionId, messages);
  }, [messages, sessionId]);

  const visibleMessages = useCallback(() => {
    let msgs = messages;
    if (msgs.length > MAX_VISIBLE) msgs = msgs.slice(-MAX_VISIBLE);
    let total = 0;
    const out: ChatMessage[] = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      total += msgs[i].content.length;
      if (total > MAX_CHARS) break;
      out.unshift(msgs[i]);
    }
    return out;
  }, [messages])();

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });
  }, []);

  /** 注入引导语 */
  const injectWelcome = useCallback((text: string) => {
    const t = (text || "").trim();
    if (!t) return;
    setMessages((prev) => {
      const hasUserMsg = prev.some((m) => m.role === "user");
      if (!hasUserMsg) {
        return [{ role: "assistant", content: t }];
      }
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && last.content === t) return prev;
      return [...prev, { role: "assistant", content: t }];
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || streaming) return;
      setError(null);
      setStreaming(true);

      setMessages((prev) => [...prev, { role: "user", content: t }]);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        await streamChat(
          sessionId,
          t,
          (ev) => {
            switch (ev.type) {
              case "delta":
                patchLast((m) => ({ ...m, content: m.content + ev.content }));
                break;
              case "reset":
                patchLast((m) => ({ ...m, content: "" }));
                break;
              case "replace":
                patchLast((m) => ({ ...m, content: ev.content }));
                break;
              case "cancelled":
                patchLast((m) =>
                  m.content === "" ? { ...m, content: "（已打断）" } : m,
                );
                break;
              case "warn":
                setError(ev.content);
                break;
              case "intent" as any: {
                const intentEv = ev as any;
                if (intentEv.action === "download") {
                  const a = document.createElement("a");
                  a.href = intentEv.url;
                  a.download = "";
                  a.style.display = "none";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } else if (intentEv.action === "view") {
                  window.open(intentEv.url, "_blank", "noopener,noreferrer");
                }
                break;
              }
              case "transfer" as any:
                setPendingTransfer(true);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  const tip = "📩 已通知本人，稍后由本人亲自回复你。";
                  if (last && last.role === "assistant" && last.content === "") {
                    const next = [...prev];
                    next[next.length - 1] = { ...last, content: tip };
                    return next;
                  }
                  return [...prev, { role: "assistant", content: tip }];
                });
                break;
              case "done":
                // 流结束：如果最后一条 AI 消息还是空的，删掉它
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant" && last.content.trim() === "") {
                    next.pop();
                  }
                  return next;
                });
                break;
              case "error":
                setError(ev.content);
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant" && last.content === "") next.pop();
                  return next;
                });
                break;
            }
          },
          ctrl.signal,
        );
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("网络异常，请稍后再试");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId, streaming, patchLast],
  );

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    await cancelStream(sessionId);
    setStreaming(false);
  }, [sessionId]);

  const clearAll = useCallback(async () => {
    const newSid = resetSessionId();
    setSessionId(newSid);
    setHumanMode(false);
    setPendingTransfer(false);
  }, []);

  return {
    sessionId,
    messages: visibleMessages,
    streaming,
    error,
    humanMode,
    pendingTransfer,
    send,
    stop,
    clearAll,
    injectWelcome,
    totalMessages: messages.length,
  };
}