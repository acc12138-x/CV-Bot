import { useEffect, useRef, useState } from "react";
import { ChatEntry } from "../App";

function detectKind(url: string): "video" | "image" | "none" {
  if (!url) return "none";
  const u = url.trim().toLowerCase().split("?")[0];
  if (/\.(mp4|webm|mov|m4v)$/.test(u)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|avif)$/.test(u)) return "image";
  return "none";
}

function isPlayableUrl(url: string): boolean {
  if (!url) return false;
  const u = url.trim();
  return (
    u.startsWith("/static/") ||
    u.startsWith("/") ||
    u.startsWith("http://") ||
    u.startsWith("https://")
  );
}

export function ProjectPage({
  project,
  index,
  total,
  isActive,
  isLast,
  onScrollDown,
  onOpenChat,
}: {
  project: any;
  index: number;
  total: number;
  isActive: boolean;
  isLast: boolean;
  onScrollDown: () => void;
  onOpenChat: (entry?: ChatEntry) => void;
}) {
  const cls = isActive ? "is-active" : "";
  const num = String(index + 1).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");

  const rawMedia = (project.mediaUrl || "").trim();
  const kind = detectKind(rawMedia);
  const canUse = isPlayableUrl(rawMedia);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => {
    setMediaError(false);
    setMediaReady(false);
  }, [rawMedia]);

  // 视频跟随 isActive：在本页播，离开暂停回到起点
  useEffect(() => {
    if (kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      try { v.currentTime = 0; } catch {}
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      try { v.pause(); v.currentTime = 0; } catch {}
    }
  }, [isActive, kind, mediaReady]);

  const handleChatClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenChat({
      welcome: project.chatWelcome,
      examples: project.chatExamples,
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  };

  const showMedia = canUse && !mediaError && kind !== "none";

  return (
    <div
      className={`project-page ${cls} ${showMedia ? "has-media" : ""}`}
      style={{ ["--accent" as any]: project.accent || "#4f46e5" }}
    >
      {/* 背景：媒体 or 渐变 */}
      {showMedia && kind === "video" && (
        <div className={`project-bg project-bg-video ${mediaReady ? "ready" : ""}`}>
          <video
            ref={videoRef}
            muted
            loop={false}
            playsInline
            preload="auto"
            onCanPlay={() => setMediaReady(true)}
            onError={() => setMediaError(true)}
          >
            <source src={rawMedia} />
          </video>
        </div>
      )}
      {showMedia && kind === "image" && (
        <div className={`project-bg project-bg-image ${mediaReady ? "ready" : ""}`}>
          <img
            src={rawMedia}
            alt=""
            onLoad={() => setMediaReady(true)}
            onError={() => setMediaError(true)}
          />
        </div>
      )}

      {/* 渐变发光（无媒体时才明显）*/}
      <div className="project-glow" />

      <div className="project-content">
        <div className="project-meta reveal" style={{ ["--i" as any]: 0 }}>
          <span className="project-num">{num}</span>
          <span className="project-slash">/</span>
          <span className="project-total">{totalStr}</span>
          {project.status && (
            <span className="project-status-pill">
              <span className="status-dot" />
              {project.status}
            </span>
          )}
        </div>

        <h2 className="project-title reveal" style={{ ["--i" as any]: 2 }}>
          {project.name}
        </h2>

        {project.subtitle && (
          <p className="project-subtitle reveal" style={{ ["--i" as any]: 4 }}>
            {project.subtitle}
          </p>
        )}

        <p className="project-desc reveal" style={{ ["--i" as any]: 6 }}>
          {project.desc}
        </p>

        {Array.isArray(project.tags) && project.tags.length > 0 && (
          <div className="project-tags reveal" style={{ ["--i" as any]: 8 }}>
            {project.tags.map((t: string, i: number) => (
              <span key={i} className="project-tag">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="project-actions reveal" style={{ ["--i" as any]: 10 }}>
          {project.link && (
            <a
              className="project-link-btn"
              href={project.link}
              target="_blank"
              rel="noreferrer"
            >
              访问项目
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          )}
          <button className="project-chat-btn" type="button" onClick={handleChatClick}>
            问 CV_Bot 这个项目
          </button>
        </div>
      </div>

      {!isLast && (
        <button
          className="scroll-hint reveal"
          style={{ ["--i" as any]: 14 }}
          onClick={onScrollDown}
          aria-label="向下滚动"
        >
          <span className="scroll-hint-label">SCROLL</span>
          <span className="scroll-hint-line" />
        </button>
      )}
    </div>
  );
}