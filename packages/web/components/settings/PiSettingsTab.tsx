"use client";

import { useState, useEffect, useCallback } from "react";
import { AppIcon } from "../AppIcon";

interface Props {
  language: "en" | "zh";
  workspace: string;
}

interface PiSettings {
  defaultProjectTrust?: string;
  defaultThinkingLevel?: string;
  hideThinkingBlock?: boolean;
  compaction?: { enabled?: boolean; reserveTokens?: number; keepRecentTokens?: number };
  retry?: { enabled?: boolean; maxRetries?: number; baseDelayMs?: number };
  warnings?: { anthropicExtraUsage?: boolean };
  steeringMode?: string;
  followUpMode?: string;
  enableSkillCommands?: boolean;
  enableInstallTelemetry?: boolean;
}

export function PiSettingsTab({ language, workspace }: Props) {
  const zh = language === "zh";
  const [global, setGlobal] = useState<PiSettings>({});
  const [project, setProject] = useState<PiSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/pi/settings?workspace=${encodeURIComponent(workspace)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setGlobal(data.global ?? {});
      setProject(data.project ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  const save = async (scope: "global" | "project", updates: Record<string, unknown>) => {
    setSaving(scope);
    setError("");
    try {
      const r = await fetch("/api/pi/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, updates, workspace }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (scope === "global") setGlobal((prev) => ({ ...prev, ...updates }));
      else setProject((prev) => ({ ...prev, ...updates }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const updateGlobal = (key: string, value: unknown) => {
    save("global", { [key]: value });
  };

  const updateNested = (scope: "global" | "project", key: string, subKey: string, value: unknown) => {
    save(scope, { [key]: { ...((scope === "global" ? global : project) as Record<string, Record<string, unknown>>)[key], [subKey]: value } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-tertiary)" }}>
        {zh ? "加载中…" : "Loading…"}
      </div>
    );
  }

  const compact = global.compaction ?? {};
  const retry = global.retry ?? {};
  const warnings = global.warnings ?? {};

  return (
    <div className="flex flex-col gap-4 text-xs p-5">
      {error && (
        <div className="px-3 py-2 text-xs" style={{ color: "oklch(60% 0.15 30)", background: "oklch(60% 0.15 30 / 0.08)", border: "1px solid oklch(60% 0.15 30 / 0.2)" }}>
          {error}
          <button className="ml-2 inline-flex align-middle hover:opacity-70" onClick={() => setError("")}><AppIcon name="x" size={11} /></button>
        </div>
      )}

      {/* ── Compaction ── */}
      <Section title={zh ? "压缩" : "Compaction"}>
        <ToggleRow
          label={zh ? "启用自动压缩" : "Auto-compaction"}
          checked={compact.enabled !== false}
          onChange={(v) => updateNested("global", "compaction", "enabled", v)}
          disabled={saving !== null}
        />
        <NumberRow
          label={zh ? "保留 Tokens（响应）" : "Reserve tokens (response)"}
          value={compact.reserveTokens ?? 16384}
          onChange={(v) => updateNested("global", "compaction", "reserveTokens", v)}
          min={1024} max={65536} step={1024}
          disabled={saving !== null}
        />
        <NumberRow
          label={zh ? "保留 Tokens（最近消息）" : "Keep recent tokens"}
          value={compact.keepRecentTokens ?? 20000}
          onChange={(v) => updateNested("global", "compaction", "keepRecentTokens", v)}
          min={4096} max={100000} step={4096}
          disabled={saving !== null}
        />
      </Section>

      {/* ── Retry ── */}
      <Section title={zh ? "重试" : "Retry"}>
        <ToggleRow
          label={zh ? "启用自动重试" : "Auto-retry"}
          checked={retry.enabled !== false}
          onChange={(v) => updateNested("global", "retry", "enabled", v)}
          disabled={saving !== null}
        />
        <NumberRow
          label={zh ? "最大重试次数" : "Max retries"}
          value={retry.maxRetries ?? 3}
          onChange={(v) => updateNested("global", "retry", "maxRetries", v)}
          min={0} max={10} step={1}
          disabled={saving !== null}
        />
        <NumberRow
          label={zh ? "基础延迟 (ms)" : "Base delay (ms)"}
          value={retry.baseDelayMs ?? 2000}
          onChange={(v) => updateNested("global", "retry", "baseDelayMs", v)}
          min={500} max={30000} step={500}
          disabled={saving !== null}
        />
      </Section>

      {/* ── Trust ── */}
      <Section title={zh ? "项目信任" : "Project Trust"}>
        <SelectRow
          label={zh ? "默认信任策略" : "Default trust"}
          value={global.defaultProjectTrust ?? "ask"}
          options={[
            { value: "ask", label: zh ? "询问" : "Ask" },
            { value: "always", label: zh ? "始终信任" : "Always" },
            { value: "never", label: zh ? "永不信任" : "Never" },
          ]}
          onChange={(v) => updateGlobal("defaultProjectTrust", v)}
          disabled={saving !== null}
        />
      </Section>

      {/* ── Warnings ── */}
      <Section title={zh ? "警告" : "Warnings"}>
        <ToggleRow
          label={zh ? "Anthropic 额外用量警告" : "Anthropic extra usage warning"}
          checked={warnings.anthropicExtraUsage !== false}
          onChange={(v) => updateNested("global", "warnings", "anthropicExtraUsage", v)}
          disabled={saving !== null}
        />
      </Section>

      {/* ── Misc ── */}
      <Section title={zh ? "其他" : "Misc"}>
        <ToggleRow
          label={zh ? "启用 /skill 命令" : "Enable /skill commands"}
          checked={global.enableSkillCommands !== false}
          onChange={(v) => updateGlobal("enableSkillCommands", v)}
          disabled={saving !== null}
        />
        <ToggleRow
          label={zh ? "安装/更新遥测" : "Install/update telemetry"}
          checked={global.enableInstallTelemetry !== false}
          onChange={(v) => updateGlobal("enableInstallTelemetry", v)}
          disabled={saving !== null}
        />
        <SelectRow
          label={zh ? "Steering 模式" : "Steering mode"}
          value={global.steeringMode ?? "one-at-a-time"}
          options={[
            { value: "one-at-a-time", label: zh ? "逐条发送" : "One at a time" },
            { value: "all", label: zh ? "全部发送" : "All" },
          ]}
          onChange={(v) => updateGlobal("steeringMode", v)}
          disabled={saving !== null}
        />
      </Section>

      {/* Raw JSON toggle */}
      <RawJsonEditor
        zh={zh}
        global={global as Record<string, unknown>}
        workspace={workspace}
        onSaved={() => load()}
      />

      {saving && (
        <div className="text-center text-[10px]" style={{ color: "var(--accent)" }}>
          {zh ? "保存中…" : "Saving…"}
        </div>
      )}
    </div>
  );
}

// ── Reusable form rows ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-0.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean;
}) {
  return (
    <label
      className="flex items-center justify-between px-2 py-1.5 cursor-pointer transition-colors hover:opacity-80"
      style={{ color: "var(--text-secondary)" }}
    >
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className="relative w-7 h-4 rounded-full transition-colors shrink-0"
        style={{
          background: checked ? "var(--accent)" : "var(--border-subtle)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ left: checked ? "calc(100% - 14px)" : "2px" }}
        />
      </button>
    </label>
  );
}

function NumberRow({ label, value, onChange, min, max, step, disabled }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          min={min} max={max} step={step}
          disabled={disabled}
          className="w-20 px-1.5 py-0.5 text-xs text-right"
          style={{
            color: "var(--text)", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          {step >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
        </span>
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-1.5 py-0.5 text-xs"
        style={{
          color: "var(--text)", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function RawJsonEditor({ zh, global, workspace, onSaved }: {
  zh: boolean; global: Record<string, unknown>; workspace: string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => { if (open) setValue(JSON.stringify(global, null, 2)); }, [open, global]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(value); } catch { throw new Error(zh ? "JSON 格式错误" : "Invalid JSON"); }
      const r = await fetch("/api/pi/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "global", updates: parsed, workspace }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMsg({ type: "success", text: zh ? "已保存" : "Saved" });
      setTimeout(() => setMsg(null), 2000);
      onSaved();
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] transition-colors hover:opacity-70" style={{ color: "var(--text-tertiary)" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {zh ? "原始 JSON 编辑" : "Raw JSON editor"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full p-3 outline-none resize-none"
            style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: "1.5", minHeight: "150px" }}
            spellCheck={false} />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}>
              {saving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存" : "Save")}
            </button>
            {msg && <span className="text-[10px]" style={{ color: msg.type === "error" ? "var(--error)" : "var(--accent)" }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
