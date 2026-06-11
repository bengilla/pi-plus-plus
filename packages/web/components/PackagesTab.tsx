"use client";

import { useState, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────

interface PackageInfo {
  source: string;
  name: string;
  version: string;
  description: string;
  type: "npm" | "git" | "path";
  path: string;
  resources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
  };
}

interface Props {
  language?: "en" | "zh";
}

// ── Component ────────────────────────────────────────────────

export function PackagesTab({ language = "en" }: Props) {
  const zh = language === "zh";
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installSource, setInstallSource] = useState("");
  const [installing, setInstalling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/pi/packages");
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPackages(data.packages ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleInstall = async () => {
    if (!installSource.trim()) return;
    setInstalling(true);
    setOutput(null);
    try {
      const r = await fetch("/api/pi/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", source: installSource.trim() }),
      });
      const data = await r.json();
      if (data.error) {
        setOutput(`❌ ${data.error}`);
      } else {
        setOutput(data.output || "✅ Installed");
        setInstallSource("");
        fetchPackages();
      }
    } catch (e) {
      setOutput(`❌ ${e instanceof Error ? e.message : "Install failed"}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleRemove = async (source: string) => {
    setRemoving(source);
    setOutput(null);
    try {
      const r = await fetch("/api/pi/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", source }),
      });
      const data = await r.json();
      if (data.error) {
        setOutput(`❌ ${data.error}`);
      } else {
        setOutput(`✅ ${zh ? "已删除" : "Removed"}`);
        fetchPackages();
      }
    } catch (e) {
      setOutput(`❌ ${e instanceof Error ? e.message : "Remove failed"}`);
    } finally {
      setRemoving(null);
    }
  };

  const handleUpdate = async (source?: string) => {
    setUpdating(true);
    setOutput(null);
    try {
      const r = await fetch("/api/pi/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", source }),
      });
      const data = await r.json();
      if (data.error) {
        setOutput(`❌ ${data.error}`);
      } else {
        setOutput(data.output || "✅ Updated");
        fetchPackages();
      }
    } catch (e) {
      setOutput(`❌ ${e instanceof Error ? e.message : "Update failed"}`);
    } finally {
      setUpdating(false);
    }
  };

  const resourceLabels = (res: PackageInfo["resources"]) => {
    const parts: string[] = [];
    if (res.extensions > 0) parts.push(`${res.extensions} ext`);
    if (res.skills > 0) parts.push(`${res.skills} skill`);
    if (res.prompts > 0) parts.push(`${res.prompts} prompt`);
    if (res.themes > 0) parts.push(`${res.themes} theme`);
    return parts.join(" · ") || (zh ? "无资源" : "no resources");
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      npm: "oklch(62% 0.19 252)",
      git: "oklch(62% 0.19 160)",
      path: "oklch(70% 0.17 85)",
    };
    return (
      <span
        className="text-[9px] px-1 py-px font-mono"
        style={{ color: colors[type] || "var(--text-tertiary)", border: `1px solid ${colors[type] || "var(--border)"}` }}
      >
        {type}
      </span>
    );
  };

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <div className="p-5 space-y-4">
      {/* Install form */}
      <div>
        <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          {zh ? "安装新包" : "Install Package"}
        </div>
        <div className="flex gap-1.5">
          <input
            value={installSource}
            onChange={(e) => setInstallSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleInstall(); }}
            placeholder={zh ? "npm:包名 或 git:仓库地址" : "npm:package or git:repo-url"}
            className="flex-1 px-2.5 py-1.5 text-xs outline-none"
            style={{
              background: "var(--bg-input)", color: "var(--text)",
              border: "1px solid var(--border)", fontFamily: "var(--font-mono)",
            }}
            spellCheck={false}
            disabled={installing}
          />
          <button
            onClick={handleInstall}
            disabled={installing || !installSource.trim()}
            className="px-3 py-1.5 text-xs shrink-0 transition-colors disabled:opacity-40"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
          >
            {installing ? (zh ? "安装中..." : "Installing...") : (zh ? "安装" : "Install")}
          </button>
        </div>
        <div className="mt-1 text-[9px]" style={{ color: "var(--text-tertiary)" }}>
          {zh ? "例如: npm:pi-frontend-create 或 git:github.com/user/repo" : "e.g. npm:pi-frontend-create or git:github.com/user/repo"}
        </div>
      </div>

      {/* Error / Output */}
      {error && (
        <div className="px-3 py-2 text-xs" style={{ color: "var(--error)", background: "oklch(0.55 0.2 30 / 0.06)", border: "1px solid oklch(0.55 0.2 30 / 0.15)" }}>
          ⚠️ {error}
          <button onClick={fetchPackages} className="ml-2 underline">{zh ? "重试" : "Retry"}</button>
        </div>
      )}
      {output && (
        <div className="px-3 py-2 text-xs whitespace-pre-wrap max-h-24 overflow-y-auto" style={{ color: "var(--text-secondary)", background: "var(--bg)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
          {output}
        </div>
      )}

      {/* Update all */}
      {packages.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
            {zh ? `已安装 ${packages.length} 个包` : `${packages.length} package(s) installed`}
          </span>
          <button
            onClick={() => handleUpdate()}
            disabled={updating}
            className="px-2.5 py-1 text-[10px] transition-colors disabled:opacity-40"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
          >
            {updating ? (zh ? "更新中..." : "Updating...") : (zh ? "全部更新" : "Update All")}
          </button>
        </div>
      )}

      {/* Package list */}
      {packages.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
          {zh ? "还没有安装 Pi 包。输入包源地址安装。" : "No Pi packages installed. Enter a package source above to install."}
        </div>
      ) : (
        <div className="space-y-1">
          {packages.map((pkg) => (
            <div
              key={pkg.source}
              className="px-3 py-2 text-xs"
              style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate" style={{ color: "var(--text)" }}>{pkg.name}</span>
                    {typeBadge(pkg.type)}
                    <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      v{pkg.version}
                    </span>
                  </div>
                  {pkg.description && (
                    <div className="mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                      {pkg.description}
                    </div>
                  )}
                  <div className="mt-0.5 text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                    {resourceLabels(pkg.resources)}
                    {pkg.resources.extensions > 0 || pkg.resources.skills > 0 || pkg.resources.prompts > 0 || pkg.resources.themes > 0 ? (
                      <span className="ml-2 opacity-50">{pkg.path}</span>
                    ) : (
                      <span className="ml-2 opacity-50">{pkg.path}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleUpdate(pkg.source)}
                    disabled={updating}
                    className="px-1.5 py-0.5 text-[9px] transition-colors disabled:opacity-40"
                    style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
                  >
                    {zh ? "更新" : "Update"}
                  </button>
                  <button
                    onClick={() => handleRemove(pkg.source)}
                    disabled={removing === pkg.source}
                    className="px-1.5 py-0.5 text-[9px] transition-colors disabled:opacity-40"
                    style={{ color: "var(--error)", border: "1px solid var(--error)", background: "transparent" }}
                  >
                    {removing === pkg.source ? (zh ? "删除中..." : "...") : (zh ? "删除" : "Remove")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
