# Pi Workspace

Pi coding agent web workspace — code, explore, and build with your local AI.

## Stack

- Next.js 16 (Turbopack) + React 19
- Tailwind CSS 4 + CSS custom properties in `packages/web/app/globals.css`
- TypeScript strict mode
- npm workspaces
- Pi 0.79+ CLI as the agent backend

## Structure

```text
packages/web/                  # Next.js app, port 31508
packages/web/lib/agents/       # Pi agent discovery, registry, spawn adapter
packages/web/lib/skills/       # Skill scanner and marketplace
packages/web/components/       # Main UI components
packages/web/app/api/pi/       # Pi-specific APIs (model, sessions, version)
```

## Main APIs

- `GET /api/agents` discovers Pi binary.
- `POST /api/agent/chat` streams agent replies over SSE.
- `POST /api/agent/stop` stops the active agent process.
- `GET /api/files?path=X` reads file trees or file content.
- `GET /api/pi/model` returns current default model.
- `GET /api/pi/models` lists all available models via `pi --list-models`.
- `POST /api/pi/models` sets default model or toggles scoped model.
- `GET /api/pi/sessions` lists Pi CLI sessions for current workspace.
- `GET /api/pi/version` checks Pi version + npm latest.
- `GET /api/skills?agent=pi` lists installed skills.
- `POST /api/skills` toggles or installs skills.

## Design Tokens

Pi green accent: `oklch(72% 0.12 175)`.
All buttons: green border + green text + transparent background + square corners.
Three-panel header height: 42px unified.

## Important Patterns

- Chat uses SSE streaming with `TransformStream` and `writer.write()`.
- `ref + rAF` bypasses React 18 batching for real-time counters.
- Client components must not import the `@/lib/agents` barrel — it pulls in `node:child_process`. Import directly from `@/lib/agents/registry` or `@/lib/agents/types`.
- Conversation history is stored in `localStorage` and scoped by workspace.
- Auto-create conversations only when `messages.length > 0`.
- Scrollable flex layouts need `flex-1 min-h-0` and constrained children.
- Theme and font scale initialize before paint to avoid flicker.
- `useState` lazy init with `localStorage` causes hydration mismatch — init with SSR-safe default, load in `useEffect`.
- CSS `:root` defaults to dark, `[data-theme="light"]` overrides. All layers must agree on the default.
- Text arbitrary values use `px` not `rem` — for scalable text, use CSS custom properties with `calc()`.

## Race Conditions

- `stdout.on('data')` → push + resolveWait pattern needs double-check after setting promise.
- Without the re-check, data between yield and next await gets stuck until next data event.

## Commands

```bash
npm run dev           # http://localhost:31508
npm run build         # Production build
npm run start         # Production server
```

## Persistent Server

- launchd config: `~/Library/LaunchAgents/com.agents-web.server.plist`
- port: `31508`
- logs: `~/.local/log/agents-web.log` and `~/.local/log/agents-web.err.log`
- after production changes: `npm run build`, then restart launchd service.

## Environment

- `AGENTS_WEB_WORKSPACE` sets the default workspace path.
