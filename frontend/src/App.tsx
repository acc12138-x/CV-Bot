import { useState, useCallback, useEffect } from "react";
import { Landing } from "./components/Landing";
import { ChatPanel } from "./components/ChatPanel";
import { AdminApp } from "./admin/AdminApp";
import { ResumePage } from "./components/ResumePage";

export type ChatOrigin = { x: number; y: number };

export type ChatEntry = {
  welcome?: string;
  examples?: string[];
  origin?: ChatOrigin;
};

export default function App() {
  const path = window.location.pathname;
  const isAdmin = path.startsWith("/admin");
  const isResume = path.startsWith("/resume");

  const [chatOpen, setChatOpen] = useState(false);
  const [entry, setEntry] = useState<ChatEntry>({});

  const openChat = useCallback((e?: ChatEntry) => {
    setEntry(e ?? {});
    setChatOpen(true);
  }, []);

  useEffect(() => {
    document.body.classList.remove("landing-mode", "admin-mode", "resume-mode");
    if (isAdmin) document.body.classList.add("admin-mode");
    else if (isResume) document.body.classList.add("resume-mode");
    else document.body.classList.add("landing-mode");
  }, [isAdmin, isResume]);

  if (isAdmin) return <AdminApp />;
  if (isResume) return <ResumePage />;

  return (
    <div className="app-shell">
      <Landing onOpenChat={openChat} />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        entry={entry}
      />
    </div>
  );
}