"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[pi++] ErrorBoundary caught:", error, info.componentStack);
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
            <div className="text-3xl mb-3">π</div>
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--error)" }}>
              Something went wrong
            </div>
            <pre
              className="text-xs mb-4 p-3 text-left overflow-auto max-h-24"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
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
