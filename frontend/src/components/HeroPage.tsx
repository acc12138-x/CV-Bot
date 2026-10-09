import { useEffect, useRef, useState } from "react";
import { ChatEntry } from "../App";

function isPlayable(url: string): boolean {
  if (!url) return false;
  const u = url.trim();
  return (
    u.startsWith("/static/") ||
    u.startsWith("/") ||
    u.startsWith("http://") ||
    u.startsWith("https://")
  );
}

export function HeroPage({
  hero,
  profile,
  navLinks,
  isActive,
  onOpenChat,
  onScrollDown,
}: {
  hero: any;
  profile: any;
  navLinks: { label: string; href: string }[];
  isActive: boolean;
  onOpenChat: (entry?: ChatEntry) => void;
  onScrollDown: () => void;
}) {
  const cls = isActive ? "is-active" : "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const rawUrl = (hero.videoUrl || "").trim();
  const shouldShowVideo = isPlayable(rawUrl) && !videoError;

  // URL 变化重置
  useEffect(() => {
    setVideoError(false);
    setVideoReady(false);
  }, [rawUrl]);

  // 页面激活 / 离开 → 控制视频播放
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isActive) {
      // 回到本页：从 0 开始播
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          /* 自动播放被拦，忽略 */
        });
      }
    } else {
      // 离开本页：暂停 + 回到起点
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [isActive, videoReady]);

  const links = [
    ...navLinks.map((l) => ({ label: l.label, href: l.href, external: true })),
    { label: profile.resumeLabel || "在线简历", href: "/resume", external: false },
  ];

  const handleCtaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenChat({
      welcome: hero.chatWelcome,
      examples: hero.chatExamples,
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  };

  return (
    <div className={`hero-page ${cls}`}>
      <div className={`hero-bg ${shouldShowVideo ? "has-video" : ""} ${videoReady ? "video-ready" : ""}`}>
        {shouldShowVideo && (
          <video
            ref={videoRef}
            muted
            loop={false}
            playsInline
            preload="auto"
            poster={hero.posterUrl || undefined}
	    disablePictureInPicture
   	    controlsList="nodownload nofullscreen noremoteplayback"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoError(true)}
          >
            <source src={rawUrl} type="video/mp4" />
          </video>
        )}
      </div>

      <header className="top-nav">
        <nav className="nav-left">
          {links.map((l, i) => (
            <a
              key={i}
              className="nav-link reveal"
              style={{ ["--i" as any]: i }}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noreferrer" : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a className="nav-brand reveal" style={{ ["--i" as any]: 4 }} href="/" onClick={(e) => e.preventDefault()}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 2.5 29.5 16 16 29.5 2.5 16 16 2.5Z" stroke="#141414" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M16 9.5 22.5 16 16 22.5 9.5 16 16 9.5Z" fill="#141414" />
          </svg>
          <span>CV_Bot</span>
        </a>

        <div className="nav-right reveal" style={{ ["--i" as any]: 5 }}>
          <button className="cta-pill" type="button" onClick={handleCtaClick}>
            {hero.primaryCtaText || "和 CV_Bot 聊聊"}
          </button>
        </div>
      </header>

      <div className="hero-content">
        {hero.badgeText && (
          <div className="hero-badge reveal" style={{ ["--i" as any]: 6 }}>
            <span className="hero-badge-dot" />
            <span className="hero-badge-text">{hero.badgeText}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
        )}

        <h1 className="hero-headline reveal" style={{ ["--i" as any]: 8 }}>
          {hero.headlineLine1 || profile.name || "你的名字"}
          {hero.headlineLine2 ? (
            <>
              <br />
              <span className="hero-headline-line2">{hero.headlineLine2}</span>
            </>
          ) : null}
        </h1>

        {Array.isArray(hero.backedByItems) && hero.backedByItems.length > 0 && (
          <div className="hero-backed reveal" style={{ ["--i" as any]: 12 }}>
            <div className="hero-backed-label">{hero.backedByLabel}</div>
            <div className="hero-backed-row">
              {hero.backedByItems.map((item: string, i: number) => (
                <span key={i} className="hero-backed-item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        className="scroll-hint reveal"
        style={{ ["--i" as any]: 16 }}
        onClick={onScrollDown}
        aria-label="向下滚动"
      >
        <span className="scroll-hint-label">SCROLL</span>
        <span className="scroll-hint-line" />
      </button>
    </div>
  );
}