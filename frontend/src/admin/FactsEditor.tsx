import { useEffect, useState } from "react";
import { admin } from "../api";

export function FactsEditor() {
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    admin
      .getFactsRaw()
      .then((d) => setYaml(d.yaml ?? ""))
      .catch((e) => setErr(e?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await admin.saveFactsRaw(yaml);
      setMsg(`已保存，共 ${r.count} 条事实`);
    } catch (e: any) {
      setErr(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-section"><p>加载中…</p></div>;

  return (
    <div className="admin-section">
      <div className="admin-head">
        <h2>事实库（facts.yaml）</h2>
        <div className="admin-head-actions">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <p className="admin-hint">
        格式：每条含 <code>id</code>（F-001 ~ F-999）、<code>topic</code>、<code>key</code>、
        <code>value</code>、<code>public</code>。保存时会校验 YAML 语法与 id 唯一性。
        保存后立即生效，无需重启。
      </p>

      {err && <div className="admin-err">{err}</div>}
      {msg && <div className="admin-msg">{msg}</div>}

      <textarea
        className="yaml-editor"
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        spellCheck={false}
        rows={24}
      />
    </div>
  );
}