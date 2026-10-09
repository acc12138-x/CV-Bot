import { ChatMessage } from "../api";
import { renderMarkdown } from "../utils/markdown";

export function MessageList({
  messages,
  streaming,
}: {
  messages: ChatMessage[];
  streaming?: boolean;
}) {
  return (
    <div className="msg-list">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isHuman = m.role === "human";
        const isLast = i === messages.length - 1;
        // 正在流式的最后一条：用纯文本，避免 Markdown 反复重排
        const isStreaming = !!(streaming && isLast && !isUser && !isHuman);

        if (isHuman) {
          return (
            <div key={i} className="msg-row is-bot is-human">
              <div className="msg-avatar msg-avatar-human">👤</div>
              <div className="msg-content">
                <div
                  className="msg-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || "…") }}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={i} className={`msg-row ${isUser ? "is-user" : "is-bot"}`}>
            {!isUser && <div className="msg-avatar msg-avatar-bot">🤖</div>}
            <div className="msg-content">
              {isStreaming ? (
                <div className="msg-body msg-body-streaming">
                  {m.content || "…"}
                </div>
              ) : (
                <div
                  className="msg-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || "…") }}
                />
              )}
            </div>
            {isUser && <div className="msg-avatar msg-avatar-user">🙋</div>}
          </div>
        );
      })}
    </div>
  );
}