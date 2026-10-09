import { useEffect, useRef, useState } from "react";
import { admin, AdminSessionSummary, AdminSessionDetail } from "../api";

function fmtTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function SessionsView({ initialSessionId }: { initialSessionId?: string } = {}) {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSessionId || null);
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [sayText, setSayText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">(initialSessionId ? "detail" : "list");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isMobile = () => window.innerWidth <= 900;

  const loadList = async () => {
    setErr(null);
    try {
      const r = await admin.listSessions(200);
      setSessions(r.sessions ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string, markSeen = false) => {
    try {
      const d = await admin.sessionDetail(id);
      setDetail(d);
      if (markSeen) {
        await admin.markSeen(id);
        setSessions((prev) =>
          prev.map((s) => (s.session_id === id ? { ...s, unread_count: 0 } : s)),
        );
      }
    } catch (e: any) {
      setErr(e?.message ?? "加载会话详情失败");
    }
  };

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!initialSessionId) return;
    if (loading) return;
    setSelectedId(initialSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialSessionId]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => loadDetail(selectedId), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView("detail");
  };

  const handleBack = () => {
    setMobileView("list");
  };

  const handleTakeover = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await admin.takeover(selectedId);
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      setErr(e?.message ?? "接管失败");
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await admin.release(selectedId);
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      setErr(e?.message ?? "释放失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSay = async () => {
    if (!selectedId || !sayText.trim()) return;
    setBusy(true);
    try {
      await admin.say(selectedId, sayText.trim());
      setSayText("");
      await loadDetail(selectedId);
    } catch (e: any) {
      setErr(e?.message ?? "发送失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("删除该会话的所有消息记录？不可恢复。")) return;
    setBusy(true);
    try {
      await admin.deleteSession(selectedId);
      setSelectedId(null);
      setDetail(null);
      await loadList();
      if (isMobile()) setMobileView("list");
    } catch (e: any) {
      setErr(e?.message ?? "删除失败");
    } finally {
      setBusy(false);
    }
  };

  const totalUnread = sessions.reduce((s, x) => s + (x.unread_count ?? 0), 0);

  if (loading) return <div className="admin-section"><p>加载中…</p></div>;

  const cls = `admin-section sessions-section wechat-mode ${isMobile() && mobileView === "detail" ? "mobile-detail" : "mobile-list"}`;

  return (
    <div className={cls}>
      <div className="admin-head sessions-head">
        <h2>
          会话记录
          {totalUnread > 0 && <span className="admin-head-badge">{totalUnread} 条未读</span>}
        </h2>
        <button className="btn-ghost" onClick={loadList}>刷新</button>
      </div>

      {err && <div className="admin-err">{err}</div>}

      {sessions.length === 0 ? (
        <p className="admin-hint">暂无会话记录。</p>
      ) : (
        <div className="sessions-layout">
          {/* 左栏：会话列表 */}
          <div className="sessions-list">
            {sessions.map((s) => {
              const unread = s.unread_count ?? 0;
              const active = selectedId === s.session_id;
              return (
                <button
                  key={s.session_id}
                  className={`session-item ${active ? "active" : ""} ${unread > 0 ? "has-unread" : ""}`}
                  onClick={() => handleSelect(s.session_id)}
                >
                  <div className="session-avatar">👤</div>
                  <div className="session-item-main">
                    <div className="session-item-top">
                      <span className="session-item-id">{shortId(s.session_id)}</span>
                      <span className="session-item-time">{fmtTime(s.last_seen_at)}</span>
                    </div>
                    <div className="session-item-row">
                      <span className="session-item-msg">{s.last_message || "(空)"}</span>
                      {unread > 0 && (
                        <span className="session-unread-badge">{unread > 99 ? "99+" : unread}</span>
                      )}
                    </div>
                    {s.mode === "human" && (
                      <span className="session-mode-tag">人工模式</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 右栏：对话详情 */}
          <div className="sessions-detail">
            {!detail ? (
              <div className="sessions-empty">
                <div className="sessions-empty-icon">💬</div>
                <div>选择左侧一条会话查看详情</div>
              </div>
            ) : (
              <>
                <div className="sessions-detail-head">
                  <button className="back-btn" onClick={handleBack} title="返回列表">
                    ←
                  </button>
                  <div className="sessions-detail-title">
                    <strong>{shortId(detail.session_id)}</strong>
                    <span className={`session-mode ${detail.mode === "human" ? "human" : "ai"}`}>
                      {detail.mode === "human" ? "人工模式" : "AI 模式"}
                    </span>
                  </div>
                  <div className="sessions-detail-actions">
                    {detail.mode === "human" ? (
                      <button className="btn-ghost" onClick={handleRelease} disabled={busy}>
                        释放给 AI
                      </button>
                    ) : (
                      <button className="btn-primary" onClick={handleTakeover} disabled={busy}>
                        接管
                      </button>
                    )}
                    <button className="btn-danger" onClick={handleDelete} disabled={busy}>
                      删除
                    </button>
                  </div>
                </div>

                <div className="sessions-msglist" ref={scrollRef}>
                  {detail.messages.length === 0 ? (
                    <div className="sessions-empty">这个会话还没有消息。</div>
                  ) : (
                    detail.messages.map((m, i) => {
                      const isUser = m.role === "user";
                      const isHuman = m.role === "human";
                      return (
                        <div
                          key={i}
                          className={`wx-msg ${isUser ? "wx-msg-right" : "wx-msg-left"} ${isHuman ? "wx-msg-human" : ""}`}
                        >
                          {!isUser && (
                            <div className="wx-avatar">
                              {isHuman ? "👤" : "🤖"}
                            </div>
                          )}
                          <div className="wx-bubble-wrap">
                            <div className="wx-bubble">{m.content}</div>
                            <div className="wx-time">{fmtTime(m.created_at)}</div>
                          </div>
                          {isUser && <div className="wx-avatar wx-avatar-user">🙋</div>}
                        </div>
                      );
                    })
                  )}
                </div>

                {detail.mode === "human" ? (
                  <div className="sessions-say">
                    <textarea
                      value={sayText}
                      onChange={(e) => setSayText(e.target.value)}
                      placeholder="以人工身份回复…"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSay();
                        }
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleSay}
                      disabled={busy || !sayText.trim()}
                    >
                      发送
                    </button>
                  </div>
                ) : (
                  <div className="sessions-say-disabled">
                    点「接管」后可人工回复
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}