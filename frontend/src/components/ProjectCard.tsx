export function ProjectCard({
  name,
  subtitle,
  desc,
  tags,
  accent,
  status,
  link,
}: {
  name: string;
  subtitle: string;
  desc: string;
  tags: string[];
  accent: string;
  status?: string;
  link?: string;
}) {
  const inner = (
    <>
      <div className="project-accent" />
      <div className="project-head">
        <div>
          <h3>{name}</h3>
          <p className="project-subtitle">{subtitle}</p>
        </div>
        {status && (
          <span className="project-status">
            <span className="status-dot" />
            {status}
          </span>
        )}
      </div>
      <p className="project-desc">{desc}</p>
      <div className="project-foot">
        <div className="project-tags">
          {tags.map((t) => (
            <span key={t} className="project-tag">
              {t}
            </span>
          ))}
        </div>
        {link && (
          <span className="project-link">
            访问
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        )}
      </div>
    </>
  );

  if (link) {
    return (
      <a
        className="project-card"
        style={{ ["--accent" as any]: accent }}
        href={link}
        target="_blank"
        rel="noreferrer"
      >
        {inner}
      </a>
    );
  }

  return (
    <article className="project-card" style={{ ["--accent" as any]: accent }}>
      {inner}
    </article>
  );
}