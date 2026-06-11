"use client";

import { useState, useEffect, useCallback } from "react";

const SIDEBAR_WIDTH_KEY = "agents-web-sidebar-width";
const RIGHT_PANEL_WIDTH_KEY = "agents-web-right-panel-width";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function useSettings() {
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [fontScale, setFontScaleState] = useState(1.1);
  const [language, setLanguageState] = useState<"en" | "zh">("en");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(520);

  // Load persisted settings on mount
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setThemeState(t === "light" ? "light" : "dark");

    const savedFs = localStorage.getItem("fontScale");
    if (savedFs) setFontScaleState(parseFloat(savedFs));

    const savedLang = localStorage.getItem("language");
    if (savedLang === "en" || savedLang === "zh") {
      setLanguageState(savedLang);
      document.documentElement.lang = savedLang === "zh" ? "zh-CN" : "en";
    }

    const savedSidebar = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (savedSidebar) setSidebarWidth(clamp(parseInt(savedSidebar, 10), 220, 420));

    const savedRightPanel = localStorage.getItem(RIGHT_PANEL_WIDTH_KEY);
    if (savedRightPanel) setRightPanelWidth(clamp(parseInt(savedRightPanel, 10), 320, 760));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.background =
        next === "dark" ? "oklch(16% 0.006 260)" : "oklch(98% 0.002 260)";
      localStorage.setItem("theme", next);
      return next;
    });
  }, []);

  const handleLanguageChange = useCallback((next: "en" | "zh") => {
    setLanguageState(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    localStorage.setItem("language", next);
  }, []);

  const handleFontScaleChange = useCallback((s: number) => {
    setFontScaleState(s);
    document.documentElement.style.setProperty("--font-scale", String(s));
    localStorage.setItem("fontScale", String(s));
  }, []);

  const persistSidebarWidth = useCallback((w: number) => {
    setSidebarWidth(w);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  }, []);

  const persistRightPanelWidth = useCallback((w: number) => {
    setRightPanelWidth(w);
    localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(w));
  }, []);

  return {
    theme,
    fontScale,
    language,
    sidebarWidth,
    rightPanelWidth,
    toggleTheme,
    handleLanguageChange,
    handleFontScaleChange,
    setSidebarWidth: persistSidebarWidth,
    setRightPanelWidth: persistRightPanelWidth,
  };
}
