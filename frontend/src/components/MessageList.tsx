import { ChatMessage } from "../api";
import { renderMarkdown } from "../utils/markdown";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="msg-list">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isHuman = m.role === "human";

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
              <div
                className="msg-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || "…") }}
              />
            </div>
            {isUser && <div className="msg-avatar msg-avatar-user">🙋</div>}
          </div>
        );
      })}
    </div>
  );
}