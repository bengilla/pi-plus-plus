# pi++

<img width="1552" height="900" alt="截屏2026-06-15 09 35 20" src="https://github.com/user-attachments/assets/dfdd22f0-04cf-452e-b687-a5c2f4d9be42" />
<img width="1552" height="899" alt="截屏2026-06-15 09 35 37" src="https://github.com/user-attachments/assets/88b297b2-90a9-46e8-a85f-995bb8d867b1" />

Pi coding agent desktop workspace — a native macOS app wrapping Pi CLI with a three-panel chat UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## Why pi++

Pi CLI is powerful, but it's terminal-only. pi++ adds a desktop UI with:

- **Three-panel layout**: sidebar (conversations), chat, settings/context panel
- **Bidirectional state**: app reads/writes Pi's native files (`auth.json`, `settings.json`, sessions `.jsonl`), no separate database
- **OAuth login**: ChatGPT Plus/Pro, Anthropic Claude — click Login, browser opens
- **VPN/proxy aware**: auto-detects proxy settings from shell profile when launched from Finder
- **Key validation**: non-blocking — saves even if network is down, tests on first use
- **Model management**: filter models by auth, toggle enabled/disabled, set default
- **Compaction**: manual compact button + auto-trigger token usage warning
- **Pi settings editor**: structured toggles/inputs for compaction, retry, trust, telemetry
- **Context files preview**: see which AGENTS.md/CLAUDE.md files Pi loaded
- **Session tree**: navigate conversation branches, fork sessions
- **Session export**: download conversations as HTML
- **Quick Copy**: copy code blocks, terminal commands, or full messages in one click
- **Responsive Sizing**: font-scale settings that dynamically adjust the entire UI typography
- **Electron shell**: native macOS app with menus, dock icon

No separate database. No vendor lock-in. Your data stays in `~/.pi/agent/`.

## Quick Start (user)

**Option A: Download pre-built app (no terminal needed)**

Download the latest `.dmg` from [Releases](../../releases), open it, drag pi++ to Applications.

**Option B: Build from source**

```bash
git clone https://github.com/bengilla/pi-plus-plus.git pi++
cd pi++
npm install
npm run app:build
open release/mac-arm64/pi++.app
```

**Prerequisites:** Node.js 20+, npm 10+, macOS 14+ (Apple Silicon).

Requires Pi CLI (`npm install -g pi-coding-agent`). The app guides you through installation on first launch.

## Loop — Auto-Fix

Loop 是一键自动修复机制：输入目标，AI 自动编写代码 → 运行验证 → 修正错误 → 独立审核，循环直到通过。

**位置：** Chat / Brief 切换栏右侧的 Loop 按钮。

**使用：**
1. 点击 Loop → 输入目标（如"修复所有类型错误"）→ 回车
2. Loop 自动运行，进度条实时显示当前阶段和轮数
3. 完成后弹出报告卡：策略、轮数、耗时、可展开日志

**工作流程：**

```
Phase 1: 直接修复 (3轮)
  ├─ pi 分析错误 → 修改代码 → 运行验证命令
  ├─ 通过 → ✅ 报告
  └─ 失败 → 升级

Phase 2: Maker + Checker (3轮)
  ├─ Maker: 编写代码
  ├─ Checker: 独立审查（不同会话，防止自评）
  ├─ PASS → ✅ 报告
  └─ FAIL → 下一轮

Phase 3: 人工介入
  └─ ⛔ 显示详细日志，请人工检查
```

**验证命令：** Loop 自动检测项目类型并生成 `.pi/verify.sh`：

| 项目类型 | 自动生成 |
|----------|----------|
| `package.json` 有 `typecheck` | `npm run typecheck` |
| `package.json` 有 `build` | `npm run build` |
| `go.mod` | `go build ./...` |
| `Cargo.toml` | `cargo build` |

也可以手动创建 `.pi/verify.sh` 自定义验证逻辑。

**无需额外安装。** Loop 完全由 pi++ 内置的 API 端点驱动，使用项目已有的 pi CLI。

## Development

```bash
npm install
npm run dev          # Web dev server → http://localhost:31508
npm run app:dev      # Electron dev mode (auto-reload)
npm run app:build    # Production .dmg → release/
```

### Stack

| Layer | Tech |
|-------|------|
| UI | Next.js 16 (Turbopack) + React 19 |
| Style | Tailwind CSS 4 + CSS custom properties |
| Desktop | Electron 33 |
| Agent | Pi CLI (spawned as child process) |
| Storage | `~/.pi/agent/` (auth.json, settings.json, .jsonl sessions) |

### Architecture

```
┌──────────────────────────────────────┐
│ Electron App                         │
│  ┌────────────────────────────────┐  │
│  │ Next.js UI (three panels)      │  │
│  │ Sidebar │ Chat │ Right Panel   │  │
│  └──────────┬─────────────────────┘  │
│             │ HTTP APIs (SSE stream) │
│  ┌──────────▼─────────────────────┐  │
│  │ Pi CLI (spawned via spawn())   │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │ bidirectional I/O
     ~/.pi/agent/
     ├── auth.json       # API keys
     ├── settings.json   # model config, thinking level
     └── sessions/       # .jsonl conversation files
```

### Project Structure

```
packages/
├── web/                  # Next.js app
│   ├── app/api/          # API routes (pi, agent, files, skills)
│   ├── components/       # ChatPanel, Sidebar, SettingsModal
│   ├── lib/agents/       # Pi agent discovery, registry, spawn adapter
│   ├── lib/skills/       # Skill scanner
│   └── lib/hooks/        # useConversations, useSettings
└── electron/             # Electron shell
    ├── main.js           # App lifecycle, server spawn
    └── preload.js        # IPC bridge
```

### Key APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pi/auth` | GET/POST | Provider keys (masked), OAuth login, key validation |
| `/api/pi/models` | GET/POST | Filtered model list + default model |
| `/api/pi/settings` | GET/POST | Read/write `~/.pi/agent/settings.json` |
| `/api/pi/context-files` | GET | Scan AGENTS.md/CLAUDE.md (global + project + parents) |
| `/api/pi/sessions` | GET/DELETE/POST | Session CRUD, branch fork |
| `/api/pi/sessions/sync` | POST | Sync Pi sessions → localStorage |
| `/api/pi/session/export` | GET | Export session as HTML via `pi --export` |
| `/api/agent/chat` | POST | SSE stream from Pi CLI |
| `/api/agent/stop` | POST | Stop running agent |
| `/api/loop` | POST | SSE stream: auto-fix loop with maker/checker phases |

### Design Tokens

- Accent: `oklch(72% 0.12 175)` (pi green)
- Buttons: green border + green text + transparent bg + square corners
- Header: 42px unified height

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Good first issues are tagged `good-first-issue`. Areas where contributions are especially welcome:

- **Cross-platform**: Windows/Linux support (Electron packaging)
- **Themes**: more color schemes beyond light/dark
- **Sidebar filters**: search, date range, tag system
- **Thinking block visualization**: collapsible/expandable reasoning display
- **Tool call UX**: inline tool execution preview, cancel running tools
- **Session reconnection**: resume interrupted Pi sessions
- **Tests**: E2E, integration, visual regression

## License

MIT — see [LICENSE](./LICENSE).
