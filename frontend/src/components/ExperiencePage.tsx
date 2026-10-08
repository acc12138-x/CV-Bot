import { useEffect, useRef, useState } from "react";

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

export function ExperiencePage({
  experience,
  footer,
  isActive,
}: {
  experience: any;
  footer: any;
  isActive: boolean;
}) {
  const cls = isActive ? "is-active" : "";
  const items = Array.isArray(experience.items) ? experience.items : [];
  const extraLinks = Array.isArray(footer?.extraLinks) ? footer.extraLinks : [];

  const rawMedia = (experience.mediaUrl || "").trim();
  const kind = detectKind(rawMedia);
  const canUse = isPlayableUrl(rawMedia);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => {
    setMediaError(false);
    setMediaReady(false);
  }, [rawMedia]);

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

  const showMedia = canUse && !mediaError && kind !== "none";

  return (
    <div className={`experience-page ${cls} ${showMedia ? "has-media" : ""}`}>
      {showMedia && kind === "video" && (
        <div className={`experience-bg experience-bg-video ${mediaReady ? "ready" : ""}`}>
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
        <div className={`experience-bg experience-bg-image ${mediaReady ? "ready" : ""}`}>
          <img
            src={rawMedia}
            alt=""
            onLoad={() => setMediaReady(true)}
            onError={() => setMediaError(true)}
          />
        </div>
      )}

      <div className="experience-glow" />

      <div className="experience-grid">
        <div className="experience-left">
          <div className="experience-eyebrow reveal" style={{ ["--i" as any]: 0 }}>
            TIMELINE
          </div>
          <h2 className="experience-title reveal" style={{ ["--i" as any]: 2 }}>
            {experience.pageTitle || "我的经历"}
          </h2>
          {experience.subtitle && (
            <p className="experience-sub reveal" style={{ ["--i" as any]: 4 }}>
              {experience.subtitle}
            </p>
          )}
        </div>

        <div className="experience-right">
          <div className="timeline">
            {items.map((it: any, i: number) => (
              <div
                className="timeline-item reveal"
                style={{ ["--i" as any]: 6 + i * 2 }}
                key={i}
              >
                <div className="timeline-year">{it.year}</div>
                <div className="timeline-body">
                  <div className="timeline-title">{it.title}</div>
                  {it.org && <div className="timeline-org">{it.org}</div>}
                  {it.desc && <div className="timeline-desc">{it.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="icp-footer">
        {footer?.icp && (
          <a
            className="icp-link"
            href={footer.icpUrl || "https://beian.miit.gov.cn/"}
            target="_blank"
            rel="noreferrer"
          >
            {footer.icp}
          </a>
        )}
        {extraLinks.map((l: any, i: number) => (
          <a
            key={i}
            className="icp-link"
            href={l.href}
            target="_blank"
            rel="noreferrer"
          >
            {l.label}
          </a>
        ))}
        {footer?.copyright && <span className="icp-copy">{footer.copyright}</span>}
      </footer>
    </div>
  );
}