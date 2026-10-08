export type ChatMessage = {
  role: "user" | "assistant" | "human";
  content: string;
  created_at?: string;
};

export type SSEEvent =
  | { type: "start"; session_id: string }
  | { type: "delta"; content: string }
  | { type: "warn"; content: string }
  | { type: "reset" }
  | { type: "replace"; content: string }
  | { type: "cancelled" }
  | { type: "transfer" }
  | { type: "done"; usage?: Record<string, number>; retried?: boolean; transfer?: boolean }
  | { type: "error"; content: string };

export type SiteProfile = {
  name: string;
  title: string;
  tagline: string;
  intro: string;
  links: { label: string; href: string }[];
  chatButtonText: string;
  resumeFile?: string;
  resumeLabel?: string;
};

export type SiteHero = {
  videoUrl: string;
  posterUrl: string;
  badgeText: string;
  badgeHref: string;
  headlineLine1: string;
  headlineLine2: string;
  backedByLabel: string;
  backedByItems: string[];
  primaryCtaText: string;
  chatWelcome?: string;
  chatExamples?: string[];
};

export type SiteProject = {
  name: string;
  subtitle: string;
  desc: string;
  tags: string[];
  accent: string;
  status?: string;
  link?: string;
  mediaUrl?: string;
  chatWelcome?: string;
  chatExamples?: string[];
};

export type MediaItem = {
  name: string;
  size: number;
  url: string;
  type: "video" | "image" | "unknown";
};

export type SiteSkillGroup = { group: string; items: string[] };

export type SiteResume = {
  pageTitle: string;
  downloadLabel: string;
  htmlContent: string;
};

export type SiteExperienceItem = {
  year: string;
  title: string;
  org: string;
  desc: string;
};

export type SiteExperience = {
  pageTitle: string;
  subtitle: string;
  items: SiteExperienceItem[];
};

export type SiteFooterExtraLink = { label: string; href: string };

export type SiteFooter = {
  icp: string;
  icpUrl: string;
  copyright: string;
  extraLinks: SiteFooterExtraLink[];
};

export type SiteAll = {
  profile: SiteProfile;
  hero: SiteHero;
  projects: SiteProject[];
  skills: SiteSkillGroup[];
  resume: SiteResume;
  experience: SiteExperience;
  footer: SiteFooter;
};

export type AdminSessionSummary = {
  session_id: string;
  mode: "ai" | "human" | string;
  created_at?: string;
  last_seen_at: string;
  last_message: string;
  last_role: string;
  message_count: number;
  unread_count?: number;
};

export type AdminSessionDetail = {
  session_id: string;
  mode: string;
  messages: { role: string; content: string; created_at: string }[];
};

const SESSION_KEY = "cvbot_session_id";
const ADMIN_KEY = "cvbot_admin_token";

// ---------------- Chat ----------------
export function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function resetSessionId(): string {
  const sid = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sid);
  return sid;
}

export async function fetchHistory(sessionId: string): Promise<ChatMessage[]> {
  const r = await fetch(`/api/session/${sessionId}/history`);
  if (!r.ok) return [];
  const data = await r.json();
  return data.messages ?? [];
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
}

export async function exportSession(sessionId: string): Promise<void> {
  const r = await fetch(`/api/session/${sessionId}/export`);
  const data = await r.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cvbot_${sessionId.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function requestContact(sessionId: string, reason: string): Promise<boolean> {
  const r = await fetch("/api/contact-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, reason }),
  });
  if (!r.ok) return false;
  const data = await r.json();
  return !!data.ok;
}

export async function cancelStream(sessionId: string): Promise<void> {
  await fetch("/api/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function streamChat(
  sessionId: string,
  message: string,
  onEvent: (ev: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal,
  });

  if (!r.ok || !r.body) {
    const err = await r.json().catch(() => ({}));
    onEvent({ type: "error", content: err.message ?? "服务暂时不可用" });
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const ev = JSON.parse(line.slice(6)) as SSEEvent;
        onEvent(ev);
      } catch {
        // ignore malformed event
      }
    }
  }
}

// ---------------- Site (public) ----------------
export async function fetchSiteAll(): Promise<SiteAll | null> {
  try {
    const r = await fetch("/api/site/all");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ---------------- Admin ----------------
export function getAdminToken(): string {
  return localStorage.getItem(ADMIN_KEY) ?? "";
}

export function setAdminToken(t: string) {
  localStorage.setItem(ADMIN_KEY, t);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_KEY);
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const r = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (r.status === 401) throw new Error("UNAUTHORIZED");
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${r.status}`);
  }
  return r.json();
}

// ---------------- Admin Auth ----------------
export async function adminLogin(password: string): Promise<{ ok: boolean; token: string }> {
  const r = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${r.status}`);
  }
  const data = await r.json();
  setAdminToken(data.token);
  return data;
}

export async function adminLogout(): Promise<void> {
  const token = getAdminToken();
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    /* ignore */
  }
  clearAdminToken();
}

export async function adminChangePassword(oldPwd: string, newPwd: string): Promise<void> {
  const token = getAdminToken();
  const r = await fetch("/api/admin/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${r.status}`);
  }
  clearAdminToken();
}

export const admin = {
  verify: () => adminFetch("/api/admin/site"),
  getAll: () => adminFetch("/api/admin/site"),
  saveSite: (key: string, value: any) =>
    adminFetch(`/api/admin/site/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  resetSite: (key: string) =>
    adminFetch(`/api/admin/site/reset/${key}`, { method: "POST" }),

  getFactsRaw: () => adminFetch("/api/admin/facts/raw"),
  saveFactsRaw: (yaml: string) =>
    adminFetch("/api/admin/facts/raw", {
      method: "PUT",
      body: JSON.stringify({ yaml }),
    }),

  stats: () => adminFetch("/api/admin/stats"),

  resumeStatus: () => adminFetch("/api/admin/resume/status"),
  deleteResume: () => adminFetch("/api/admin/resume", { method: "DELETE" }),
  uploadResume: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/resume", {
      method: "POST",
      headers: { "X-Admin-Token": getAdminToken() },
      body: fd,
    });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },

  // ---- 会话 ----
  listSessions: (limit = 200): Promise<{ sessions: AdminSessionSummary[] }> =>
    adminFetch(`/api/admin/sessions?limit=${limit}`),
  activeSessions: (minutes = 60): Promise<{ sessions: AdminSessionSummary[] }> =>
    adminFetch(`/api/admin/sessions/active?minutes=${minutes}`),
  sessionDetail: (id: string): Promise<AdminSessionDetail> =>
    adminFetch(`/api/admin/sessions/${id}`),
  markSeen: (id: string) =>
    adminFetch(`/api/admin/sessions/${id}/mark_seen`, { method: "POST" }),
  deleteSession: (id: string) =>
    adminFetch(`/api/admin/sessions/${id}`, { method: "DELETE" }),
  takeover: (id: string) =>
    adminFetch(`/api/admin/sessions/${id}/takeover`, { method: "POST" }),
  release: (id: string) =>
    adminFetch(`/api/admin/sessions/${id}/release`, { method: "POST" }),
  say: (id: string, content: string) =>
    adminFetch(`/api/admin/sessions/${id}/say`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // ---- 通用媒体（视频 + 图片）----
  listMedia: (): Promise<{ items: MediaItem[] }> =>
    adminFetch("/api/admin/media"),
  deleteMedia: (name: string) =>
    adminFetch(`/api/admin/media/${encodeURIComponent(name)}`, { method: "DELETE" }),
  uploadMedia: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${getAdminToken()}` },
      body: fd,
    });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },

  // ---- 飞书 ----
  testFeishu: (): Promise<{ ok: boolean; message: string }> =>
    adminFetch("/api/admin/feishu/test", { method: "POST" }),
};