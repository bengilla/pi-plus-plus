"use client";

export function GeneralTab({
  fontScale, onFontScaleChange, language, onLanguageChange,
}: {
  fontScale?: number;
  onFontScaleChange?: (s: number) => void;
  language: "en" | "zh";
  onLanguageChange?: (language: "en" | "zh") => void;
}) {
  const scale = fontScale ?? 1;

  return (
    <div className="p-5 space-y-5">
      {/* Language */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>{language === "zh" ? "语言" : "Language"}</div>
        <div className="inline-flex overflow-hidden text-xs" style={{ border: "1px solid var(--color-border)" }}>
          {([{ value: "en", label: "English" }, { value: "zh", label: "中文" }] as const).map((option) => (
            <button
              key={option.value}
              onClick={() => onLanguageChange?.(option.value)}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: "transparent",
                color: language === option.value ? "var(--accent)" : "var(--text-secondary)",
                border: language === option.value ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font scale */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{language === "zh" ? "字体大小" : "Font Size"}</span>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>80%</span>
          <input type="range" min="0.8" max="1.4" step="0.05" value={scale}
            onChange={(e) => onFontScaleChange?.(parseFloat(e.target.value))}
            className="flex-1 h-1.5 appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((scale - 0.8) / 0.6) * 100}%, var(--border) ${((scale - 0.8) / 0.6) * 100}%, var(--border) 100%)` }} />
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>140%</span>
        </div>
        <div className="flex justify-between mt-1">
          {[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4].map((v) => (
            <button key={v} onClick={() => onFontScaleChange?.(v)}
              className="text-[9px] px-1 py-0.5 transition-colors hover:opacity-70"
              style={{ color: scale === v ? "var(--accent)" : "var(--text-secondary)", background: "transparent", border: scale === v ? "1px solid var(--accent)" : "1px solid transparent" }}>
              {Math.round(v * 100)}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
