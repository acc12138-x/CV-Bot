import { useEffect, useState } from "react";
import { fetchSiteAll, SiteResume, SiteFooter } from "../api";

export function ResumePage() {
  const [resume, setResume] = useState<SiteResume | null>(null);
  const [footer, setFooter] = useState<SiteFooter | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSiteAll()
      .then((s) => {
        if (alive) {
          setResume(s?.resume ?? null);
          setFooter(s?.footer ?? null);
        }
      })
      .catch(() => { if (alive) setResume(null); })
      .finally(() => { if (alive) setLoaded(true); });

    // 检查后端是否上传了原文件
    fetch("/api/site/resume", { method: "HEAD" })
      .then((r) => { if (alive) setHasFile(r.ok); })
      .catch(() => { if (alive) setHasFile(false); });

    return () => { alive = false; };
  }, []);

  if (!loaded) return <div className="resume-loading" />;
  if (!resume) {
    return (
      <div className="resume-error">
        <p>简历内容加载失败，请稍后重试。</p>
        <a href="/">返回首页</a>
      </div>
    );
  }

  const extraLinks = Array.isArray(footer?.extraLinks) ? footer.extraLinks : [];

  return (
    <div className="resume-page">
      <header className="resume-nav">
        <a href="/" className="resume-back">← 返回首页</a>
        <div className="resume-actions">
          {hasFile && (
            <a href="/api/site/resume" className="resume-btn-primary" download>
              {resume.downloadLabel || "下载简历"}
            </a>
          )}
        </div>
      </header>

      <main className="resume-content">
        <div
          className="resume-html"
          dangerouslySetInnerHTML={{ __html: resume.htmlContent || "" }}
        />
      </main>

      <footer className="resume-footer">
        <div className="resume-footer-inner">
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
            <a key={i} className="icp-link" href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
          {footer?.copyright && <span className="icp-copy">{footer.copyright}</span>}
        </div>
      </footer>
    </div>
  );
}