"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ModelSwitcher } from "@/components/ModelSwitcher";
import { ChatPanel } from "@/components/ChatPanel";

// Parse dropped folder path from macOS Finder
function getDroppedPath(e: DragEvent): string | null {
  // Debug: log all drag data types
  const types = e.dataTransfer.types;
  console.log("[drag] types:", types);

  // Method 1: text/uri-list (primary on macOS)
  const uri = e.dataTransfer.getData("text/uri-list");
  console.log("[drag] text/uri-list:", JSON.stringify(uri));
  if (uri) {
    // Handle formats: "file:///path", "file://localhost/path", "# summary\nfile:///path"
    const lines = uri.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      let decoded = decodeURIComponent(line.trim());
      // Strip file:// protocol (with optional host)
      decoded = decoded.replace(/^file:\/\/[^/]*/, ""); // removes file:// or file://localhost
      if (decoded.startsWith("/") && decoded.length > 2) return decoded;
    }
  }

  // Method 2: text/plain (some browsers/OS combinations)
  const plain = e.dataTransfer.getData("text/plain");
  console.log("[drag] text/plain:", JSON.stringify(plain));
  if (plain && plain.startsWith("file://")) {
    let decoded = decodeURIComponent(plain.replace(/^file:\/\/[^/]*/, ""));
    if (decoded.startsWith("/") && decoded.length > 2) return decoded;
  }

  return null;
}

export default function Home() {
  const [workspace, setWorkspace] = useState<string>("/Users/bengilla/Documents/DXP2800/github/agents-web");
  const [activeAgent, setActiveAgent] = useState<string>("pi");
  const [dragOver, setDragOver] = useState(false);
  const historyRef = useRef<string[]>([]);

  const navigateTo = useCallback((newPath: string) => {
    setWorkspace((prev) => {
      if (prev !== newPath) {
        historyRef.current.push(prev);
      }
      return newPath;
    });
  }, []);

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) setWorkspace(prev);
  }, []);

  const canGoBack = historyRef.current.length > 0;

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
    const path = getDroppedPath(e);
    if (path) setWorkspace(path);
  }, []);

  return (
    <div className="flex h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sidebar — file tree */}
      <Sidebar
        workspace={workspace}
        onWorkspaceChange={navigateTo}
      />

      {/* Center — agent conversation + input */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b shrink-0"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="px-1.5 py-0.5 text-xs rounded transition-colors"
              style={{
                color: canGoBack ? "var(--color-text)" : "var(--color-text-secondary)",
                opacity: canGoBack ? 1 : 0.3,
              }}
              title="Back"
            >
              ←
            </button>
            <span className="font-semibold text-sm tracking-tight">agents-web</span>
            <ModelSwitcher value={activeAgent} onChange={setActiveAgent} />
          </div>
        </header>

        {/* Chat + input area */}
        <ChatPanel activeAgent={activeAgent} workspace={workspace} fullPage />
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: "oklch(0.68 0.21 250 / 0.08)", backdropFilter: "blur(2px)" }}>
          <div className="px-8 py-6 rounded-xl text-center"
            style={{
              background: "var(--color-surface)",
              border: "2px dashed var(--color-accent)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
            }}>
            <div className="text-3xl mb-2">📁</div>
            <div className="text-sm font-medium">Drop folder here</div>
          </div>
        </div>
      )}
    </div>
  );
}
