import { useEffect, useRef, useState } from "react";
import { admin, getAdminToken, adminLogin, adminLogout, adminChangePassword } from "../api";
import { FactsEditor } from "./FactsEditor";
import { SessionsView } from "./SessionsView";

type Tab =
  | "hero"
  | "projects"
  | "experience"
  | "resume"
  | "profile"
  | "skills"
  | "resume-file"
  | "footer"
  | "site"
  | "feishu"
  | "facts"
  | "sessions"
  | "security"
  | "stats";

export function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(true);
  const [pwdInput, setPwdInput] = useState("");
  // 从 URL 参数读目标会话（飞书跳转链接带 ?session=xxx）
  const urlSession = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("session") || "";
    } catch {
      return "";
    }
  })();
  const [tab, setTab] = useState<Tab>(urlSession ? "sessions" : "hero");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [site, setSite] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setBooting(false);
      return;
    }
    admin
      .getAll()
      .then((data) => {
        setSite(data);
        setAuthed(true);
      })
      .catch(() => {
        // token 失效，清掉
        try { localStorage.removeItem("cvbot_admin_token"); } catch {}
        setAuthed(false);
      })
      .finally(() => setBooting(false));
  }, []);

  const login = async () => {
    setErr(null);
    setLoading(true);
    try {
      await adminLogin(pwdInput);
      const data = await admin.getAll();
      setSite(data);
      setAuthed(true);
      setPwdInput("");
    } catch (e: any) {
      setErr(e?.message && e.message !== "HTTP 401" ? e.message : "密码错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed && tab === "stats") {
      admin.stats().then(setStats).catch(() => setStats(null));
    }
  }, [authed, tab]);

  const save = async (key: string, value: any) => {
    setErr(null);
    try {
      await admin.saveSite(key, value);
      setSite({ ...site, [key]: value });
      alert("已保存");
    } catch (e: any) {
      setErr(e?.message ?? "保存失败");
    }
  };

  const reset = async (key: string) => {
    if (!confirm(`重置 ${key} 为默认？`)) return;
    try {
      await admin.resetSite(key);
      const data = await admin.getAll();
      setSite(data);
    } catch (e: any) {
      setErr(e?.message ?? "重置失败");
    }
  };

  const logout = async () => {
    await adminLogout();
    setAuthed(false);
    setSite(null);
  };

  // 计算媒体使用情况：URL -> [使用位置]
  const usageMap: Record<string, string[]> = {};
  if (site) {
    const heroVideo = site.hero?.videoUrl;
    if (heroVideo) {
      (usageMap[heroVideo] ||= []).push("首页 Hero");
    }
    (site.projects ?? []).forEach((p: any) => {
      if (p.mediaUrl) {
        (usageMap[p.mediaUrl] ||= []).push(p.name || "未命名项目");
      }
    });
  }

  if (booting) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>CV_Bot 管理后台</h1>
          <p>加载中…</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>CV_Bot 管理后台</h1>
          <p>输入密码进入</p>
          <input
            type="password"
            value={pwdInput}
            onChange={(e) => setPwdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="密码"
            autoFocus
          />
          <button className="btn-primary" onClick={login} disabled={loading}>
            {loading ? "验证中…" : "进入"}
          </button>
          {err && <div className="admin-login-err">{err}</div>}
          <div className="admin-login-hint">
            首次登录：用 <code>.env</code> 里的 <code>ADMIN_TOKEN</code> 作为初始密码。<br />
            登录后请到「安全设置」修改。
          </div>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>加载配置失败</h1>
          <p>请刷新重试</p>
          <button className="btn-primary" onClick={() => location.reload()}>刷新</button>
        </div>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ["hero", "首页 Hero"],
    ["projects", "项目页面"],
    ["experience", "我的经历"],
    ["resume", "在线简历"],
    ["profile", "个人信息"],
    ["skills", "技术栈"],
    ["resume-file", "简历文件"],
    ["footer", "页脚 / 备案"],
    ["feishu", "飞书设置"],
    ["facts", "事实库"],
    ["sessions", "会话记录"],
    ["security", "安全设置"],
    ["stats", "统计"],
  ];

  return (
    <div className="admin-app">
      <aside className="admin-side">
        <div className="admin-brand">
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", display: "inline-block" }}
          />
          CV_Bot 管理
        </div>
        <nav>
          {tabs.map(([k, label]) => (
            <button
              key={k}
              className={`admin-tab ${tab === k ? "active" : ""}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="/" className="admin-link">← 查看首页</a>
          <a href="/resume" className="admin-link" target="_blank" rel="noreferrer">↗ 查看在线简历</a>
          <button className="admin-link" onClick={logout}>登出</button>
        </div>
      </aside>

      <main className="admin-main">
        {err && <div className="admin-err">{err}</div>}

        {tab === "hero" && (
          <HeroEditor value={site.hero} usageMap={usageMap} ownerLabel="首页 Hero" onSave={(v) => save("hero", v)} onReset={() => reset("hero")} />
        )}
        {tab === "projects" && (
          <ProjectsEditor value={site.projects} usageMap={usageMap} onSave={(v) => save("projects", v)} onReset={() => reset("projects")} />
        )}
        {tab === "experience" && (
          <ExperienceEditor value={site.experience} onSave={(v) => save("experience", v)} onReset={() => reset("experience")} />
        )}
        {tab === "resume" && (
          <ResumeEditor value={site.resume} onSave={(v) => save("resume", v)} onReset={() => reset("resume")} />
        )}
        {tab === "profile" && (
          <ProfileEditor value={site.profile} onSave={(v) => save("profile", v)} onReset={() => reset("profile")} />
        )}
        {tab === "skills" && (
          <SkillsEditor value={site.skills} onSave={(v) => save("skills", v)} onReset={() => reset("skills")} />
        )}
        {tab === "resume-file" && <ResumeFilePanel />}
        {tab === "footer" && (
          <FooterEditor value={site.footer} onSave={(v) => save("footer", v)} onReset={() => reset("footer")} />
        )}
        {tab === "feishu" && (
          <FeishuEditor
            value={site.feishu}
            siteValue={site.site}
            onSaveFeishu={(v) => save("feishu", v)}
            onSaveSite={(v) => save("site", v)}
            onReset={() => { reset("feishu"); reset("site"); }}
          />
        )}
        {tab === "facts" && <FactsEditor />}
        {tab === "sessions" && <SessionsView initialSessionId={urlSession} />}
        {tab === "security" && <SecurityEditor onDone={logout} />}
        {tab === "stats" && (
          <div className="admin-section">
            <h2>统计</h2>
            {stats ? (
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-val">{stats.messages}</div><div className="stat-label">总消息数</div></div>
                <div className="stat-card"><div className="stat-val">{stats.sessions}</div><div className="stat-label">会话数</div></div>
                <div className="stat-card"><div className="stat-val">¥{stats.total_cost_cny}</div><div className="stat-label">累计花费</div></div>
                <div className="stat-card"><div className="stat-val">¥{stats.daily_budget_cny}</div><div className="stat-label">日预算</div></div>
                <div className="stat-card wide"><div className="stat-val">{stats.model}</div><div className="stat-label">当前模型</div></div>
              </div>
            ) : (<p>加载中…</p>)}
          </div>
        )}
      </main>
    </div>
  );
}

/* ==================== Hero ==================== */
function HeroEditor({
  value,
  usageMap,
  ownerLabel,
  onSave,
  onReset,
}: {
  value: any;
  usageMap: Record<string, string[]>;
  ownerLabel: string;
  onSave: (v: any) => void;
  onReset: () => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>首页 Hero</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <h3>背景视频</h3>
      <MediaPicker
        value={v.videoUrl ?? ""}
        usageMap={usageMap}
        ownerLabel={ownerLabel}
        onChange={(url) => set("videoUrl", url)}
        onUploadSuccess={(url) => {
          const next = { ...v, videoUrl: url };
          setV(next);
          onSave(next);
        }}
      />

      <Field label="视频封面图 URL（可留空）" value={v.posterUrl ?? ""} onChange={(x) => set("posterUrl", x)} />

      <h3>文案</h3>
      <Field label="徽标文字" value={v.badgeText ?? ""} onChange={(x) => set("badgeText", x)} />
      <div className="field-row">
        <Field label="大标题第一行" value={v.headlineLine1 ?? ""} onChange={(x) => set("headlineLine1", x)} />
        <Field label="大标题第二行" value={v.headlineLine2 ?? ""} onChange={(x) => set("headlineLine2", x)} />
      </div>
      <div className="field-row">
        <Field label="技术栈标签文字" value={v.backedByLabel ?? ""} onChange={(x) => set("backedByLabel", x)} />
        <Field label="CTA 按钮文字" value={v.primaryCtaText ?? ""} onChange={(x) => set("primaryCtaText", x)} />
      </div>
      <Field
        label="技术栈（逗号分隔）"
        value={(v.backedByItems ?? []).join(", ")}
        onChange={(x) => set("backedByItems", x.split(",").map((s) => s.trim()).filter(Boolean))}
      />

      <h3>聊天入口文案（点首页 CTA 后弹出的引导）</h3>
      <Field
        label="欢迎语（支持 Markdown）"
        value={v.chatWelcome ?? ""}
        onChange={(x) => set("chatWelcome", x)}
        textarea
        rows={6}
      />
      <Field
        label="示例问题（每行一个，点一下就发送）"
        value={(v.chatExamples ?? []).join("\n")}
        onChange={(x) => set("chatExamples", x.split("\n").map((s) => s.trim()).filter(Boolean))}
        textarea
        rows={5}
      />
    </div>
  );
}

/* ==================== Projects ==================== */
function ProjectsEditor({
  value,
  usageMap,
  onSave,
  onReset,
}: {
  value: any[];
  usageMap: Record<string, string[]>;
  onSave: (v: any) => void;
  onReset: () => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);

  const update = (i: number, k: string, x: any) => {
    const arr = [...v];
    arr[i] = { ...arr[i], [k]: x };
    setV(arr);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= v.length) return;
    const arr = [...v];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setV(arr);
  };

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>项目页面</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <p className="admin-hint">
        顺序即页面顺序。用「↑ ↓」调整。每个项目可配一张背景图或一段背景视频（视频只在该页显示时播放）。
      </p>

      {v.map((p, i) => (
        <div key={i} className="editor-card">
          <div className="editor-card-head">
            <strong>{p.name || "(未命名项目)"}</strong>
            <div className="editor-card-actions">
              <button className="btn-mini" onClick={() => move(i, i - 1)} disabled={i === 0}>↑</button>
              <button className="btn-mini" onClick={() => move(i, i + 1)} disabled={i === v.length - 1}>↓</button>
              <button className="btn-danger" onClick={() => setV(v.filter((_, j) => j !== i))}>删除</button>
            </div>
          </div>
          <Field label="名称" value={p.name} onChange={(x) => update(i, "name", x)} />
          <Field label="副标题" value={p.subtitle} onChange={(x) => update(i, "subtitle", x)} />
          <Field label="描述" value={p.desc} onChange={(x) => update(i, "desc", x)} textarea />
          <Field label="项目链接（可留空）" value={p.link ?? ""} onChange={(x) => update(i, "link", x)} />
          <Field
            label="标签（逗号分隔）"
            value={(p.tags ?? []).join(", ")}
            onChange={(x) => update(i, "tags", x.split(",").map((s) => s.trim()).filter(Boolean))}
          />
          <div className="field-row">
            <Field label="主色（#hex）" value={p.accent} onChange={(x) => update(i, "accent", x)} />
            <Field label="状态" value={p.status ?? ""} onChange={(x) => update(i, "status", x)} />
          </div>

          <h3>背景媒体</h3>
          <MediaPicker
            value={p.mediaUrl ?? ""}
            usageMap={usageMap}
            ownerLabel={p.name || "未命名项目"}
            onChange={(url) => update(i, "mediaUrl", url)}
            onUploadSuccess={(url) => {
              const arr = [...v];
              arr[i] = { ...arr[i], mediaUrl: url };
              setV(arr);
              onSave(arr);
            }}
          />

          <h3>聊天入口文案（点这个项目页的「问 CV_Bot」按钮后弹出）</h3>
          <Field
            label="欢迎语（支持 Markdown）"
            value={p.chatWelcome ?? ""}
            onChange={(x) => update(i, "chatWelcome", x)}
            textarea
            rows={5}
          />
          <Field
            label="示例问题（每行一个）"
            value={(p.chatExamples ?? []).join("\n")}
            onChange={(x) => update(i, "chatExamples", x.split("\n").map((s) => s.trim()).filter(Boolean))}
            textarea
            rows={4}
          />
        </div>
      ))}

      <button
        className="btn-ghost"
        onClick={() => setV([...v, {
          name: "新项目", subtitle: "", desc: "", tags: [], accent: "#4f46e5",
          status: "在线", link: "", mediaUrl: "", chatWelcome: "", chatExamples: []
        }])}
      >
        + 添加项目
      </button>
    </div>
  );
}

/* ==================== 媒体选择器 ==================== */
function MediaPicker({
  value,
  usageMap,
  ownerLabel,
  onChange,
  onUploadSuccess,
}: {
  value: string;
  usageMap: Record<string, string[]>;
  ownerLabel: string;
  onChange: (url: string) => void;
  onUploadSuccess?: (url: string) => void;
}) {
  const [items, setItems] = useState<{ name: string; size: number; url: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "image">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    admin.listMedia().then((r) => setItems(r.items ?? [])).catch(() => setItems([]));
  };
  useEffect(load, []);

  const doUpload = async (f: File) => {
    setUploading(true); setErr(null); setMsg(null);
    try {
      const r = await admin.uploadMedia(f);
      setMsg(`已上传并选用：${r.name}（${(r.size / 1024 / 1024).toFixed(2)} MB），正在保存…`);
      onChange(r.url);
      if (onUploadSuccess) onUploadSuccess(r.url);
      load();
    } catch (e: any) {
      setErr(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`删除 ${name}？`)) return;
    try {
      await admin.deleteMedia(name);
      if (value === `/static/${name}`) onChange("");
      load();
    } catch (e: any) {
      setErr(e?.message ?? "删除失败");
    }
  };

  const filtered = items.filter((it) => filter === "all" || it.type === filter);
  const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(value);

  return (
    <div className="media-picker">
      {err && <div className="admin-err">{err}</div>}
      {msg && <div className="admin-msg">{msg}</div>}

      <div className="media-picker-row">
        <input
          ref={fileRef}
          type="file"
          accept=".mp4,.webm,.mov,.jpg,.jpeg,.png,.gif,.webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); }}
          style={{ display: "none" }}
        />
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "上传中…" : "上传视频 / 图片"}
        </button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="media-filter"
        >
          <option value="all">全部</option>
          <option value="video">仅视频</option>
          <option value="image">仅图片</option>
        </select>
      </div>

      {filtered.length > 0 && (
        <div className="media-grid">
          {filtered.map((it) => {
            const usedBy = (usageMap[it.url] ?? []).filter((n) => n !== ownerLabel);
            const usedByCurrent = value === it.url;
            return (
              <div key={it.name} className={`media-cell ${usedByCurrent ? "active" : ""}`}>
                <button
                  type="button"
                  className="media-cell-preview"
                  onClick={() => onChange(it.url)}
                  title="点击选用"
                >
                  {it.type === "video" ? (
                    <video src={it.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={it.url} alt="" />
                  )}
                </button>

                {usedBy.length > 0 && (
                  <div className="media-cell-usage" title={`已被 ${usedBy.join("、")} 使用`}>
                    <span className="media-cell-usage-dot" />
                    {usedBy.length > 1 ? `${usedBy.length} 处使用` : usedBy[0]}
                  </div>
                )}

                {usedByCurrent && (
                  <div className="media-cell-current-badge">当前</div>
                )}

                <div className="media-cell-info">
                  <span className="media-cell-name" title={it.name}>{it.name}</span>
                  <span className="media-cell-size">{(it.size / 1024 / 1024).toFixed(2)}M</span>
                </div>
                <button
                  type="button"
                  className="media-cell-del"
                  onClick={() => remove(it.name)}
                  title="删除"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="media-current">
        <span className="admin-hint" style={{ margin: 0 }}>
          当前：{!value ? <span style={{ color: "#94a3b8" }}>（未设置）</span> : <code>{value}</code>}
          {value && (
            <button
              type="button"
              className="btn-mini"
              style={{ marginLeft: 8 }}
              onClick={() => onChange("")}
            >清除</button>
          )}
        </span>
      </div>

      {value && isVideo && (
        <div className="media-preview">
          <video src={value} autoPlay muted loop playsInline />
        </div>
      )}
      {value && !isVideo && value.startsWith("/") && (
        <div className="media-preview">
          <img src={value} alt="" />
        </div>
      )}
    </div>
  );
}

/* ==================== Experience ==================== */
function ExperienceEditor({ value, onSave, onReset }: { value: any; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  const updateItem = (i: number, k: string, x: any) => {
    const arr = [...(v.items ?? [])];
    arr[i] = { ...arr[i], [k]: x };
    set("items", arr);
  };
  const moveItem = (from: number, to: number) => {
    const arr = [...(v.items ?? [])];
    if (to < 0 || to >= arr.length) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    set("items", arr);
  };

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>我的经历</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <div className="field-row">
        <Field label="页面标题" value={v.pageTitle ?? ""} onChange={(x) => set("pageTitle", x)} />
        <Field label="副标题" value={v.subtitle ?? ""} onChange={(x) => set("subtitle", x)} />
      </div>

      <h3>背景媒体</h3>
      <MediaPicker
        value={v.mediaUrl ?? ""}
        usageMap={{}}
        ownerLabel="我的经历"
        onChange={(url) => set("mediaUrl", url)}
      />

      <h3>经历条目</h3>
      {(v.items ?? []).map((it: any, i: number) => (
        <div key={i} className="editor-card">
          <div className="editor-card-head">
            <strong>{it.title || "(未命名经历)"}</strong>
            <div className="editor-card-actions">
              <button className="btn-mini" onClick={() => moveItem(i, i - 1)} disabled={i === 0}>↑</button>
              <button className="btn-mini" onClick={() => moveItem(i, i + 1)} disabled={i === (v.items?.length ?? 0) - 1}>↓</button>
              <button className="btn-danger" onClick={() => set("items", v.items.filter((_: any, j: number) => j !== i))}>删除</button>
            </div>
          </div>
          <div className="field-row">
            <Field label="年份" value={it.year ?? ""} onChange={(x) => updateItem(i, "year", x)} />
            <Field label="组织/类型" value={it.org ?? ""} onChange={(x) => updateItem(i, "org", x)} />
          </div>
          <Field label="标题" value={it.title ?? ""} onChange={(x) => updateItem(i, "title", x)} />
          <Field label="描述" value={it.desc ?? ""} onChange={(x) => updateItem(i, "desc", x)} textarea />
        </div>
      ))}

      <button className="btn-ghost" onClick={() => set("items", [...(v.items ?? []), { year: "", title: "", org: "", desc: "" }])}>+ 添加经历</button>
    </div>
  );
}

/* ==================== Resume Content ==================== */
function ResumeEditor({ value, onSave, onReset }: { value: any; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>在线简历</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <p className="admin-hint">这是 <code>/resume</code> 页显示的内容。支持 HTML。「下载 PDF」调浏览器打印。</p>

      <div className="field-row">
        <Field label="页面标题" value={v.pageTitle ?? ""} onChange={(x) => set("pageTitle", x)} />
        <Field label="下载按钮文案" value={v.downloadLabel ?? ""} onChange={(x) => set("downloadLabel", x)} />
      </div>

      <div className="field">
        <label>简历 HTML 内容</label>
        <textarea
          className="yaml-editor"
          value={v.htmlContent ?? ""}
          onChange={(e) => set("htmlContent", e.target.value)}
          rows={24}
          spellCheck={false}
        />
      </div>

      <div className="resume-preview">
        <div className="resume-preview-label">预览</div>
        <div className="resume-html" dangerouslySetInnerHTML={{ __html: v.htmlContent || "" }} />
      </div>
    </div>
  );
}

/* ==================== Footer ==================== */
function FooterEditor({ value, onSave, onReset }: { value: any; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>页脚 / 备案</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <Field label="ICP 备案号" value={v.icp ?? ""} onChange={(x) => set("icp", x)} />
      <Field label="备案号链接" value={v.icpUrl ?? ""} onChange={(x) => set("icpUrl", x)} />
      <Field label="版权文字（可留空）" value={v.copyright ?? ""} onChange={(x) => set("copyright", x)} />

      <h3>额外链接</h3>
      {(v.extraLinks ?? []).map((l: any, i: number) => (
        <div key={i} className="link-row">
          <input value={l.label} onChange={(e) => {
            const arr = [...(v.extraLinks ?? [])];
            arr[i] = { ...l, label: e.target.value };
            set("extraLinks", arr);
          }} placeholder="名字" />
          <input value={l.href} onChange={(e) => {
            const arr = [...(v.extraLinks ?? [])];
            arr[i] = { ...l, href: e.target.value };
            set("extraLinks", arr);
          }} placeholder="https://..." />
          <button className="btn-danger" onClick={() => set("extraLinks", (v.extraLinks ?? []).filter((_: any, j: number) => j !== i))}>删除</button>
        </div>
      ))}
      <button className="btn-ghost" onClick={() => set("extraLinks", [...(v.extraLinks ?? []), { label: "", href: "" }])}>+ 添加链接</button>
    </div>
  );
}

/* ==================== Resume File ==================== */
function ResumeFilePanel() {
  const [status, setStatus] = useState<{ exists: boolean; file?: string; size?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    admin.resumeStatus().then(setStatus).catch(() => setStatus({ exists: false }));
  };
  useEffect(refresh, []);

  const upload = async (f: File) => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await admin.uploadResume(f);
      setMsg(`已上传：${r.file}（${(r.size / 1024).toFixed(1)} KB）`);
      refresh();
    } catch (e: any) {
      setErr(e?.message ?? "上传失败");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!confirm("删除已上传的简历？")) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await admin.deleteResume();
      setMsg("已删除");
      refresh();
    } catch (e: any) {
      setErr(e?.message ?? "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-head"><h2>简历文件（PDF/DOCX）</h2></div>
      <p className="admin-hint">可选。上传后 /resume 页的「下载原文件」按钮提供下载。</p>

      {err && <div className="admin-err">{err}</div>}
      {msg && <div className="admin-msg">{msg}</div>}

      <div className="resume-box">
        <div className="resume-status">
          当前状态：
          {status?.exists ? (
            <>
              <span className="resume-badge ok">已上传</span>
              <span>{status.file} · {((status.size ?? 0) / 1024).toFixed(1)} KB</span>
            </>
          ) : (
            <span className="resume-badge none">未上传</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            style={{ display: "none" }}
          />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "处理中…" : status?.exists ? "替换文件" : "上传文件"}
          </button>
          {status?.exists && (
            <>
              <a className="btn-secondary" href="/api/site/resume" target="_blank" rel="noreferrer">预览</a>
              <button className="btn-danger" onClick={remove} disabled={busy}>删除</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== Profile ==================== */
function ProfileEditor({ value, onSave, onReset }: { value: any; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>个人信息</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <Field label="姓名" value={v.name ?? ""} onChange={(x) => set("name", x)} />
      <Field label="头衔" value={v.title ?? ""} onChange={(x) => set("title", x)} />
      <Field label="一句话标语" value={v.tagline ?? ""} onChange={(x) => set("tagline", x)} />
      <Field label="简介" value={v.intro ?? ""} onChange={(x) => set("intro", x)} textarea />
      <div className="field-row">
        <Field label="对话按钮文案" value={v.chatButtonText ?? ""} onChange={(x) => set("chatButtonText", x)} />
        <Field label="在线简历链接文案" value={v.resumeLabel ?? ""} onChange={(x) => set("resumeLabel", x)} />
      </div>

      <h3>导航链接</h3>
      {(v.links ?? []).map((l: any, i: number) => (
        <div key={i} className="link-row">
          <input value={l.label} onChange={(e) => {
            const arr = [...v.links];
            arr[i] = { ...l, label: e.target.value };
            set("links", arr);
          }} placeholder="名字" />
          <input value={l.href} onChange={(e) => {
            const arr = [...v.links];
            arr[i] = { ...l, href: e.target.value };
            set("links", arr);
          }} placeholder="https://..." />
          <button className="btn-danger" onClick={() => set("links", v.links.filter((_: any, j: number) => j !== i))}>删除</button>
        </div>
      ))}
      <button className="btn-ghost" onClick={() => set("links", [...(v.links ?? []), { label: "", href: "" }])}>+ 添加链接</button>
    </div>
  );
}

/* ==================== Skills ==================== */
function SkillsEditor({ value, onSave, onReset }: { value: any[]; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>技术栈</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      {v.map((g, i) => (
        <div key={i} className="editor-card">
          <div className="editor-card-head">
            <strong>分组 {i + 1}</strong>
            <button className="btn-danger" onClick={() => setV(v.filter((_, j) => j !== i))}>删除</button>
          </div>
          <Field label="分组名" value={g.group} onChange={(x) => {
            const arr = [...v];
            arr[i] = { ...g, group: x };
            setV(arr);
          }} />
          <Field label="技能（逗号分隔）" value={(g.items ?? []).join(", ")} onChange={(x) => {
            const arr = [...v];
            arr[i] = { ...g, items: x.split(",").map((s) => s.trim()).filter(Boolean) };
            setV(arr);
          }} />
        </div>
      ))}

      <button className="btn-ghost" onClick={() => setV([...v, { group: "新分组", items: [] }])}>+ 添加分组</button>
    </div>
  );
}

/* ==================== Site ==================== */
function SiteEditor({ value, onSave, onReset }: { value: any; onSave: (v: any) => void; onReset: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>站点设置</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={() => onSave(v)}>保存</button>
        </div>
      </div>

      <p className="admin-hint">
        站点地址用于生成**飞书通知里的跳转链接**。上线后改成正式域名，比如
        <code>https://accggcc.online</code>。
      </p>

      <Field
        label="站点地址（含 http(s)://，不要末尾斜杠）"
        value={v.siteUrl ?? ""}
        onChange={(x) => set("siteUrl", x)}
      />

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!v.notifyLinkEnabled}
            onChange={(e) => set("notifyLinkEnabled", e.target.checked)}
            style={{ width: "auto" }}
          />
          在飞书通知里附上跳转链接
        </label>
      </div>

      <div className="admin-hint" style={{ marginTop: 20 }}>
        <strong>提示</strong>：飞书通知会带上 <code>{v.siteUrl}/admin?session=xxx</code>，
        点击就能直接打开对应会话。手机上的飞书也能用。
      </div>
    </div>
  );
}

/* ==================== Feishu + Site ==================== */
function FeishuEditor({
  value,
  siteValue,
  onSaveFeishu,
  onSaveSite,
  onReset,
}: {
  value: any;
  siteValue: any;
  onSaveFeishu: (v: any) => void;
  onSaveSite: (v: any) => void;
  onReset: () => void;
}) {
  // 防御：value 可能是 undefined
  const [v, setV] = useState<any>(value || {});
  const [sv, setSv] = useState<any>(siteValue || {});
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);

  useEffect(() => { setV(value || {}); }, [value]);
  useEffect(() => { setSv(siteValue || {}); }, [siteValue]);

  const set = (k: string, x: any) => setV({ ...v, [k]: x });
  const setS = (k: string, x: any) => setSv({ ...sv, [k]: x });

  const doTest = async () => {
    setTesting(true); setTestMsg(null); setTestErr(null);
    try {
      const r = await admin.testFeishu();
      if (r.ok) setTestMsg(r.message);
      else setTestErr(r.message);
    } catch (e: any) {
      setTestErr(e?.message ?? "测试失败");
    } finally {
      setTesting(false);
    }
  };

  const saveAll = async () => {
    try {
      await onSaveFeishu(v);
      await onSaveSite(sv);
    } catch {}
  };

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>飞书设置</h2>
        <div className="admin-head-actions">
          <button className="btn-ghost" onClick={onReset}>重置默认</button>
          <button className="btn-primary" onClick={saveAll}>保存</button>
        </div>
      </div>

      <h3>飞书通知</h3>
      <p className="admin-hint">
        Webhook URL 留空则用 <code>.env</code> 里的 <code>FEISHU_WEBHOOK_URL</code>。
      </p>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={v.enabled !== false}
            onChange={(e) => set("enabled", e.target.checked)}
            style={{ width: "auto" }}
          />
          启用飞书通知
        </label>
      </div>

      <Field
        label="飞书 Webhook URL（可留空）"
        value={v.webhookUrl ?? ""}
        onChange={(x) => set("webhookUrl", x)}
      />

      <div className="field">
        <label>加急关键词（逗号分隔，命中就发加急卡片）</label>
        <textarea
          value={Array.isArray(v.urgentKeywords) ? v.urgentKeywords.join(", ") : ""}
          onChange={(e) =>
            set("urgentKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
          }
          rows={3}
        />
      </div>

      {testMsg && <div className="admin-msg">{testMsg}</div>}
      {testErr && <div className="admin-err">{testErr}</div>}
      <button className="btn-secondary" onClick={doTest} disabled={testing}>
        {testing ? "发送中…" : "发送测试消息"}
      </button>
      <p className="admin-hint" style={{ marginTop: 10 }}>
        点一下会向飞书发一条测试消息（用**当前保存的配置**）。改过 URL 先「保存」再测试。
      </p>

      <h3>站点地址</h3>
      <p className="admin-hint">
        用于飞书通知里的跳转链接。本地填 <code>http://localhost:5173</code>，
        上线后填 <code>https://你的域名</code>。
      </p>

      <Field
        label="站点地址（含 http(s)://，不要末尾斜杠）"
        value={sv.siteUrl ?? ""}
        onChange={(x) => setS("siteUrl", x)}
      />

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={sv.notifyLinkEnabled !== false}
            onChange={(e) => setS("notifyLinkEnabled", e.target.checked)}
            style={{ width: "auto" }}
          />
          在飞书通知里附上跳转链接
        </label>
      </div>
    </div>
  );
}
/* ==================== Security ==================== */
function SecurityEditor({ onDone }: { onDone: () => void }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setMsg(null);
    if (!oldPwd || !newPwd) { setErr("请填写完整"); return; }
    if (newPwd.length < 8) { setErr("新密码至少 8 位"); return; }
    if (newPwd !== confirmPwd) { setErr("两次输入的新密码不一致"); return; }
    setBusy(true);
    try {
      await adminChangePassword(oldPwd, newPwd);
      setMsg("密码已修改，即将跳转登录页…");
      setTimeout(() => onDone(), 1500);
    } catch (e: any) {
      setErr(e?.message ?? "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-head"><h2>安全设置</h2></div>
      <p className="admin-hint">
        修改后台登录密码。密码用 PBKDF2 加密存储，不保存明文。<br />
        修改后所有已登录设备都需要重新登录。
      </p>

      {err && <div className="admin-err">{err}</div>}
      {msg && <div className="admin-msg">{msg}</div>}

      <div style={{ maxWidth: 420 }}>
        <div className="field">
          <label>当前密码</label>
          <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="输入当前密码" />
        </div>
        <div className="field">
          <label>新密码（至少 8 位）</label>
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="至少 8 位" />
        </div>
        <div className="field">
          <label>确认新密码</label>
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="再次输入新密码"
          />
        </div>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "修改中…" : "修改密码"}
        </button>
      </div>
    </div>
  );
}

/* ==================== helpers ==================== */
function Field({
  label,
  value,
  onChange,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows ?? 3} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}