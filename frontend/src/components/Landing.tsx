import { useEffect, useRef, useState } from "react";
import { fetchSiteAll, SiteAll } from "../api";
import { HeroPage } from "./HeroPage";
import { ProjectPage } from "./ProjectPage";
import { ExperiencePage } from "./ExperiencePage";
import { ChatEntry } from "../App";

export function Landing({
  onOpenChat,
}: {
  onOpenChat: (entry?: ChatEntry) => void;
}) {
  const [site, setSite] = useState<SiteAll | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchSiteAll()
      .then((s) => { if (alive) setSite(s); })
      .catch((e) => console.error("[Landing] fetchSiteAll:", e))
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!site) return;
    const container = scrollRef.current;
    if (!container) return;
    const pages = container.querySelectorAll("[data-page-index]");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.pageIndex);
            if (!isNaN(idx)) setCurrentPage(idx);
          }
        });
      },
      { root: container, threshold: 0.55 },
    );
    pages.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [site]);

  const scrollToPage = (i: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-page-index="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!loaded) return <div className="landing-loading" />;
  if (!site) {
    return (
      <div className="landing-error">
        <h2>暂时无法加载页面配置</h2>
        <p>请确认后端服务已启动，然后刷新重试。</p>
      </div>
    );
  }

  const profile = site.profile ?? ({} as any);
  const hero = site.hero ?? ({} as any);
  const projects = Array.isArray(site.projects) ? site.projects : [];
  const experience = site.experience ?? ({} as any);
  const footer = site.footer ?? ({} as any);
  const links = Array.isArray(profile.links) ? profile.links : [];

  const totalPages = 1 + projects.length + 1;
  const experienceIndex = 1 + projects.length;

  return (
    <>
      <div className="scroll-root" ref={scrollRef}>
        <section className="snap-page" data-page-index={0}>
          <HeroPage
            hero={hero}
            profile={profile}
            navLinks={links}
            isActive={currentPage === 0}
            onOpenChat={onOpenChat}
            onScrollDown={() => scrollToPage(1)}
          />
        </section>

        {projects.map((p: any, i: number) => (
          <section className="snap-page" data-page-index={i + 1} key={`${p.name}-${i}`}>
            <ProjectPage
              project={p}
              index={i}
              total={projects.length}
              isActive={currentPage === i + 1}
              isLast={i === projects.length - 1}
              onScrollDown={() => scrollToPage(i + 2)}
              onOpenChat={onOpenChat}
            />
          </section>
        ))}

        <section className="snap-page" data-page-index={experienceIndex}>
          <ExperiencePage
            experience={experience}
            footer={footer}
            isActive={currentPage === experienceIndex}
          />
        </section>
      </div>

      <nav className="page-dots" aria-label="页面导航">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            className={`page-dot ${currentPage === i ? "active" : ""}`}
            onClick={() => scrollToPage(i)}
            aria-label={`第 ${i + 1} 页`}
          />
        ))}
      </nav>
    </>
  );
}