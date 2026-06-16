# pi++

pi++ coding agent desktop workspace — code, explore, and build with your local AI.

## Stack

- Next.js 16 (Turbopack) + React 19
- Tailwind CSS 4 + CSS custom properties
- TypeScript strict mode
- npm workspaces
- Electron 33 (desktop shell)
- Pi 0.79+ CLI as agent backend

## Commands

```bash
npm run dev           # Web dev → http://localhost:31508
npm run build         # Production build
npm run app:dev       # Electron dev mode
npm run app:build     # Production .dmg → release/
```

## Architecture

```
packages/
├── web/                  # Next.js app
│   ├── app/api/          # API routes
│   ├── components/       # ChatPanel, Sidebar, SettingsModal, AppIcon
│   ├── lib/agents/       # Pi discovery, spawn adapter
│   ├── lib/auth/         # Provider auth helpers
│   ├── lib/skills/       # Skill scanner
│   └── lib/hooks/        # useConversations, useSettings
└── electron/             # Electron shell
    ├── main.js           # App lifecycle, server spawn
    └── preload.js        # IPC bridge
```

## Design Tokens

- Accent: `oklch(72% 0.12 175)` (pi green)
- Buttons: green border + green text + transparent bg + square corners
- Header: 42px unified height

## Important Patterns

- Chat uses SSE streaming with `TransformStream` and `writer.write()`
- `ref + rAF` bypasses React 18 batching for real-time counters
- Client components must NOT import `@/lib/agents` barrel — it pulls in `node:child_process`. Import from `@/lib/agents/types` or `@/lib/agents/registry` directly
- Conversations stored in `localStorage`, scoped by workspace; messages loaded on-demand
- Auto-create conversations only when `messages.length > 0`
- Scrollable flex layouts need `flex-1 min-h-0`
- Theme & font scale init before paint to avoid flicker
- `useState` lazy init with `localStorage` → hydrate mismatch. SSR-safe default, load in `useEffect`
- CSS `:root` dark, `[data-theme="light"]` overrides. All layers agree on default

## Race Conditions (v0.2.x)

- `stdout.on('data')` → push + resolveWait needs double-check after setting promise
- `handleStop`: capture refs FIRST, then abort — abort triggers finally which clears refs
- `syncPiSessions`: use `setIndexes((prev) => ...)` functional update to avoid stale snapshot
- `deleteConversationsByWorkspace`: uses `deletingSessionIds` ref to prevent `syncPiSessions` from re-adding sessions whose DELETE request is still in-flight

## Environment

- `PI_PLUS_PLUS_WORKSPACE` sets default workspace path
- When launched from Finder/Dock (not terminal), the Electron app doesn't inherit `HTTP_PROXY`/`HTTPS_PROXY`. `readProxyFromShell()` in `main.js` explicitly sources `~/.zshrc` to inject proxy vars into the server process. Whitelist-only: only proxy keys are passed, not `NODE_OPTIONS`.

## Auth Validation

- Key validation is non-blocking — network errors (timeout, connection refused) save silently with `type: "network"`; only API auth rejections (401/403/429) show a warning with `type: "invalid"`
- AuthTab shows warning as yellow notice + green success, not a red error

## Context Files

- API only returns files that actually exist on disk (`exists: true` filter)
- API response uses `name` and `scope` fields (not `displayPath`/`level`) to match the frontend interface

## AppIcon System

- `AppIcon.tsx` — 24 SVG icons (`IconName` union type), single-file, no deps, `currentColor`
- `FileTypeIcon` — file extension→color+glyph mapping (TS→blue, JS→yellow, etc.), folder with open/closed state
- Replaces all inline emoji/SVG across ChatPanel, ChatInput, Sidebar, FileTree, SettingsModal, WelcomeScreen
- Icons: chevron-right/down, check, arrow-up, bug, compass, copy, download, edit, external, file, folder, info, message-plus, paperclip, plus, refresh, save, search, settings, stop, trash, x, zap

## Logo Assets

- Source: `images/pi_green_transparent.png` (1024px, green on transparent)
- Electron icon: `packages/electron/assets/icon.png` (512px, green logo on `#101514` bg)
- Public web icons: `favicon.svg`, `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192x192.png`, `icon-512x512.png`
- Inline logos: `logo.png`, `logo-44.png`, `logo-64.png`, `logo-80.png` (all green, transparent)
- `AgentIcon` and `Logo` components use `logo-44.png` (2x retina, displayed at variable size)
- Splash screen uses `logo.png` (80px, pulse animation)

## Auto Update (Electron)

- `checkForUpdates()` — hits GitHub Releases API (`/repos/:owner/:repo/releases/latest`), compares semver with `getCurrentVersion()` from `package.json`
- Runs 10s after startup, then every 24h (silent); also exposed via IPC + preload (`checkForUpdates`, `getVersion`)
- `showUpdateDialog()` — native macOS dialog with [立即更新] / [稍后提醒]
- `downloadAndInstall()` — opens progress window, streams DMG download with percent+MB display
- `installFromDMG()` — mounts DMG via `hdiutil attach`, writes detached shell script to replace .app + restart
- Update script template: kill old → `rm -rf` old bundle → `cp -R` from DMG → detach DMG → `open` new app

## Versioning (Semver)

`MAJOR.MINOR.PATCH` — follow semver strictly. During `0.x` phase, MAJOR may change freely.

| 触发 | 改动 | 示例 |
|------|------|------|
| Bug 修复, typo, 样式微调 | PATCH `0.1.0→0.1.1` | `npm version patch` |
| 新功能, 向后兼容 | MINOR `0.1.0→0.2.0` | `npm version minor` |
| 破坏性变更, 架构大改 | MAJOR `0.x→1.0.0` | `npm version major` |

**发版流程：**
```bash
npm version patch|minor|major    # 同步更新两个 package.json 的 version
npm run app:build                # 构建 DMG
git tag v$(node -p "require('./packages/electron/package.json').version")
gh release create vX.Y.Z release/pi++-X.Y.Z-arm64.dmg --title "vX.Y.Z" --notes "..."
git push --follow-tags
```
旧用户启动后 10s 自动检测到新版本 → 弹窗 → 一键下载安装重启。

## GitHub

- [ ] GitHub Actions CI — auto `npx tsc --noEmit` + `npm run build` on PR
- [ ] Branch protection — require PR review before merge to main
- [ ] Enable Discussions tab
- [ ] Project board
