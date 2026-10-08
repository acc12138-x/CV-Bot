import { useState } from "react";
import { requestContact } from "../api";

export function ContactButton({ sessionId }: { sessionId: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const click = async () => {
    if (loading || sent) return;
    setLoading(true);
    const ok = await requestContact(sessionId, "访客点击请求联系方式");
    setLoading(false);
    if (ok) setSent(true);
  };

  return (
    <button className="contact-chip" onClick={click} disabled={loading || sent}>
      <span className="contact-chip-icon">{sent ? "✅" : "✉️"}</span>
      <span>{sent ? "已通知本人" : loading ? "发送中…" : "请求联系方式"}</span>
    </button>
  );
}