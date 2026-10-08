import { useRef, useState, useEffect } from "react";

export function InputBox({
  onSend,
  onStop,
  streaming,
}: {
  onSend: (t: string) => void;
  onStop: () => void;
  streaming: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 自动增高
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [text]);

  const submit = () => {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="composer">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="问我任何问题，比如「你做过哪些项目？」"
        rows={1}
        disabled={streaming}
      />
      {streaming ? (
        <button className="composer-btn composer-btn-stop" onClick={onStop} aria-label="停止生成">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      ) : (
        <button
          className="composer-btn composer-btn-send"
          onClick={submit}
          disabled={!text.trim()}
          aria-label="发送"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}