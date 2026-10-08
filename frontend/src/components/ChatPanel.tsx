import { useEffect, useRef, useState } from "react";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { useChat } from "../hooks/useChat";
import { ChatEntry } from "../App";

export function ChatPanel({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry: ChatEntry;
}) {
  const { messages, streaming, error, humanMode, pendingTransfer, send, stop, clearAll, injectWelcome } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [examples, setExamples] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const welcome = (entry.welcome || "").trim();
    const ex = Array.isArray(entry.examples) ? entry.examples.filter(Boolean) : [];
    if (welcome) injectWelcome(welcome);
    setExamples(ex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSend = (t: string) => {
    setExamples([]);
    send(t);
  };

  const handleNewChat = () => {
    if (!confirm("开始新对话？当前对话会清空。")) return;
    clearAll();
    setExamples([]);
  };

  const origin = entry.origin ?? { x: window.innerWidth, y: window.innerHeight };

  return (
    <>
      <div
        className={`chat-overlay ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`chat-panel ${open ? "open" : ""}`}
        style={{
          ["--origin-x" as any]: `${origin.x}px`,
          ["--origin-y" as any]: `${origin.y}px`,
        }}
        role="dialog"
        aria-modal="true"
      >
        <header className="chat-header">
          <div className="chat-title">
            <div className={`chat-avatar ${humanMode ? "human" : ""} ${pendingTransfer ? "pending" : ""}`}>
              <span className="chat-avatar-emoji">
                {humanMode ? "👤" : "🤖"}
              </span>
              <span className={`chat-avatar-status ${pendingTransfer && !humanMode ? "pending" : ""}`} />
            </div>
            <div>
              <div className="chat-name">CV_Bot</div>
              <div className="chat-status">
                {streaming
                  ? "正在输入…"
                  : humanMode
                  ? "本人正在回复"
                  : pendingTransfer
                  ? "已通知本人 · 等待回复"
                  : "在线 · 立即回复"}
              </div>
            </div>
          </div>
          <div className="chat-actions">
            <button className="icon-btn" onClick={handleNewChat} title="开始新对话">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 4v16M4 12h16" />
              </svg>
            </button>
            <button className="icon-btn" onClick={onClose} title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="chat-body" ref={scrollRef}>
          <MessageList messages={messages} />
          {examples.length > 0 && !streaming && (
            <div className="chat-examples">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  className="chat-example-chip"
                  onClick={() => handleSend(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="chat-error">
            <span className="chat-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="chat-input-area">
          <InputBox onSend={handleSend} onStop={stop} streaming={streaming} />
        </div>
      </div>
    </>
  );
}