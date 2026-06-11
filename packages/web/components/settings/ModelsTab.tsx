"use client";

import { useState, useEffect } from "react";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  capabilities: { key: string; label: string }[];
}

export function ModelsTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pi/models")
      .then((r) => r.json())
      .then((data: { models: ModelInfo[]; defaultModel: string | null }) => {
        setModels(data.models);
        setDefaultModel(data.defaultModel || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleModel = async (modelId: string, enabled: boolean) => {
    setToggling(modelId);
    try {
      await fetch("/api/pi/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, enabled }),
      });
      setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, enabled } : m));
    } catch { /* ignore */ }
    setToggling(null);
  };

  const selectDefaultModel = async (modelId: string) => {
    setDefaultModel(modelId);
    try {
      await fetch("/api/pi/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
    } catch { /* ignore */ }
  };

  const grouped = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const list = grouped.get(m.provider) || [];
    list.push(m);
    grouped.set(m.provider, list);
  }

  const capColor = (key: string) => {
    switch (key) {
      case "thinking": return { color: "oklch(65% 0.15 155)", bg: "oklch(65% 0.15 155 / 0.1)" };
      case "vision": return { color: "oklch(68% 0.13 250)", bg: "oklch(68% 0.13 250 / 0.1)" };
      default: return { color: "var(--text-tertiary)", bg: "var(--bg-hover)" };
    }
  };

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <div className="p-5">
      <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {zh ? "开启开关的模型会出现在对话框的模型选择中。" : "Toggle models on to make them available in the chat model selector."}
      </div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {[...grouped.entries()].map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: "var(--accent)" }}>
              {provider}
            </div>
            <div className="space-y-0.5">
              {providerModels.map((m) => {
                const isDefault = defaultModel === m.id;
                const isBusy = toggling === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    style={{
                      background: isDefault ? "var(--accent-dim)" : "var(--bg)",
                      border: isDefault ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      onClick={() => toggleModel(m.id, !m.enabled)}
                      disabled={isBusy}
                      className="relative h-4 w-8 shrink-0 transition-colors disabled:opacity-50"
                      style={{
                        background: m.enabled ? "var(--accent)" : "var(--bg-hover)",
                        border: `1px solid ${m.enabled ? "var(--accent)" : "var(--border-light)"}`,
                      }}
                    >
                      <span
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 transition-all"
                        style={{
                          left: m.enabled ? "16px" : "2px",
                          background: m.enabled ? "#fff" : "var(--text-tertiary)",
                        }}
                      />
                    </button>
                    <span
                      className="flex-1 truncate font-medium cursor-pointer hover:opacity-70"
                      onClick={() => { if (!isDefault) selectDefaultModel(m.id); }}
                      style={{ color: "var(--text)" }}
                    >
                      {m.name}
                      {isDefault && <span className="ml-1 text-[9px]" style={{ color: "var(--accent)" }}>default</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {m.capabilities.filter((c) => c.key !== "text").map((c) => (
                        <span
                          key={c.key}
                          className="text-[8px] px-1 py-0.5"
                          style={{ color: capColor(c.key).color, background: capColor(c.key).bg }}
                        >
                          {c.label}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
