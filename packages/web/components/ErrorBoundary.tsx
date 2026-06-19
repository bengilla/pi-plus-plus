"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[pi++] ErrorBoundary caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="flex items-center justify-center p-8"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          <div className="text-center max-w-md">
            <img src="/logo-64.png" alt="pi++" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--error)" }}>
              Something went wrong
            </div>
            <pre
              className="text-xs mb-4 p-3 text-left overflow-auto max-h-24"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {this.state.error.message}
            </pre>
            {this.state.componentStack && (
              <>
                <div className="text-[10px] mb-1" style={{ color: "var(--text-tertiary)" }}>Component stack:</div>
                <pre
                  className="text-[10px] mb-4 p-3 text-left overflow-auto max-h-32"
                  style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-tertiary)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                >
                  {this.state.componentStack}
                </pre>
              </>
            )}
            <button
              onClick={() => this.setState({ error: null, componentStack: null })}
              className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
