# agents-web UI Redesign — Design Spec

**Date:** 2026-06-08
**Status:** Approved
**References:** pi-web v0.6.12, Codex Desktop v26.519

## 1. Overview

Transform agents-web from a two-column functional prototype into a three-column professional multi-agent workspace. The redesign follows a "Dark Industrial Precision" aesthetic — VS Code's restraint, Linear's rhythm, Codex's polish.

### Goals

- Three-column layout: Sidebar | Main Chat | Right Context Panel
- Agent switching as a first-class interaction (tabs at top of sidebar)
- Dark-first design system with precise token hierarchy
- Panel collapse/expand with smooth animations
- File preview & agent info in right panel
- Composer upgrades: @mentions, file drag-drop, context chips
- Welcome screen with starter cards for new conversations
- All existing functionality preserved (agent spawning, SSE streaming, skills, file ops)

### Non-Goals

- Agent marketplace / CLI installer (future phase)
- Electron/Tauri wrapper (stays as localhost web app)
- Real-time collaboration

## 2. Layout Architecture

```
┌──────────────────┬────────────────────────┬──────────────────┐
│    SIDEBAR 260px │     MAIN (flex-1)       │  RIGHT PANEL     │
│    (collapsible) │                        │  0 ↔ 42%         │
│                  │                        │  (collapsible)   │
│  ┌ AGENT TABS ─┐│  ┌ CHAT HEADER ───────┐│  ┌ FILE PREVIEW┐ │
│  │ Claude Code  ││  │ Model · Usage ·    ││  │              │ │
│  │ Codex  · Pi  ││  │ Stop button       ││  │ Syntax-high  │ │
│  └─────────────┘│  └───────────────────┘│  │ lighted code │ │
│  ┌ EXPLORER ───┐│                        │  └─────────────┘ │
│  │ File tree    ││  ┌ MESSAGE LIST ─────┐│  ┌ AGENT INFO ─┐ │
│  │ w/ new file  ││  │ User & assistant  ││  │ Version      │ │
│  │ rename/del   ││  │ messages with     ││  │ Capabilities │ │
│  └─────────────┘│  │ markdown, thinking ││  │ Token usage  │ │
│  ┌ CONVERSATIONS│  │ tool call blocks   ││  └─────────────┘ │
│  │ Session list ││  └───────────────────┘│  ┌ CONTEXT ────┐ │
│  │ w/ NEW btn   ││  ┌ COMPOSER ─────────┐│  │ Active files │ │
│  └─────────────┘│  │ @mentions · chips  ││  │ Session info │ │
│                  │  │ [Stop]    [Send]   ││  └─────────────┘ │
└──────────────────┴────────────────────────┴──────────────────┘
```

### Panel States

| Panel | Default | Collapse Trigger | Width |
|-------|---------|------------------|-------|
| Sidebar | Open | `Cmd+B` or edge click | 0 ↔ 260px |
| Right Panel | Closed | File click / agent info click | 0 ↔ 42% (min 300px) |

### Responsive Breakpoints

| Width | Behavior |
|-------|----------|
| > 1024px | Full three-column |
| 641-1024px | Sidebar collapsible overlay, right panel 100% overlay |
| < 641px | Single column, sidebars as overlays |

## 3. Design System

### Color Tokens

**Dark theme (default):**
```css
--color-bg:            oklch(16% 0.006 260);   /* deep blue-gray */
--color-surface:       oklch(20% 0.005 260);   /* panel surfaces */
--color-surface-hover: oklch(24% 0.004 260);
--color-surface-elevated: oklch(22% 0.005 260);
--color-border:        oklch(30% 0.003 260);   /* sharp boundaries */
--color-text:          oklch(93% 0 0);         /* high-contrast white */
--color-text-secondary: oklch(62% 0.01 260);
--color-text-tertiary:  oklch(45% 0.01 260);
--color-accent:        oklch(66% 0.19 252);    /* cobalt blue */
--color-accent-hover:  oklch(72% 0.19 252);
--color-accent-dim:    oklch(48% 0.19 252 / 0.15);
--color-user-bubble:   oklch(26% 0.04 250);    /* blue-tinted user msg */
--color-tool-bg:       oklch(22% 0.01 260);    /* tool call background */
--color-success:       oklch(62% 0.19 160);    /* green for done */
--color-warning:       oklch(70% 0.17 85);     /* amber for running */
--color-error:         oklch(55% 0.22 20);     /* red */
```

**Light theme:** Inverse luminance with preserved hue angles.

### Typography

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Noto Sans Mono', ui-monospace, monospace;
```

| Usage | Font | Size | Weight |
|-------|------|------|--------|
| UI text | Sans | 13px | 400 |
| UI labels | Sans | 10px | 600 | (uppercase, tracking)
| Code blocks | Mono | 13px | 400 |
| File paths | Mono | 12px | 400 |
| Message text | Sans | 14px | 400 |
| Headings | Sans | 15-18px | 600 |

### Spacing

- Base grid: 4px
- Section padding: 8px, 12px, 16px
- Component gaps: 4px, 8px
- Message padding: 12px 16px

### Border Radius

| Element | Value |
|---------|-------|
| Buttons, inputs | 6px |
| Cards, panels | 8px |
| Code blocks | 8px |
| Tool calls | 6px |
| Messages | 8px |

### Shadows

```css
--shadow-panel: 0 1px 3px rgba(0,0,0,0.3);
--shadow-overlay: 0 4px 12px rgba(0,0,0,0.4);
--shadow-modal: 0 8px 24px rgba(0,0,0,0.5);
```

### Animation Tokens

| Scene | Duration | Easing |
|-------|----------|--------|
| Panel expand/collapse | 200ms | cubic-bezier(0.16,1,0.3,1) |
| Message enter | 150ms | ease-out |
| Hover transition | 100ms | ease-out |
| Tool pulse | 1.5s | ease-in-out infinite |
| Button press | 100ms | ease-out |

## 4. Component Specifications

### 4.1 Sidebar

**AgentSwitcher** — Tab-style selector at top of sidebar.
- Shows discovered agents with icon + name
- Active agent has accent underline + dim background
- Inactive agents: secondary text, no background
- Height: 42px

**ExplorerSection** — Collapsible file tree section.
- Header: "▾ EXPLORER" toggle
- Workspace selector: compact dropdown at top
- FileTree: existing component, polished styling
- New file/folder inline creation
- Context menu on right-click (future)

**ConversationsSection** — Collapsible conversations list.
- Header: "▾ CONVERSATIONS" + NEW button
- Session entries: agent icon + title
- Active session: accent color text
- Hover: surface-hover background + delete button
- Auto-create on first message to new agent

### 4.2 Main Chat

**ChatHeader**
- Agent name + model indicator
- Token usage live counter (animated)
- Stop button (visible only when streaming)

**WelcomeScreen** (when no active conversation)
- Agent name + description
- 2-3 starter prompt cards
- Simple, clean layout

**MessageList**
- Virtualized scrolling for performance
- Auto-scroll to bottom on new messages
- Messages grouped by turn (user → assistant)

**Message** (extracted from current inline rendering)
- User: right-aligned bubble, blue-tinted background
- Assistant: left-aligned, transparent background
- Per-message footer: tokens in/out, cost, copy, timestamp
- MarkdownBody: react-markdown + remark-gfm + PrismLight
- ThinkingBlock: collapsible, shows duration, auto-dedup for DeepSeek
- ToolCallBlock: expandable JSON input, status (running/done/error)
- ToolResultBlock: collapsible output

**Composer**
- Multi-line textarea (auto-grow to 6 lines, then scroll)
- @mention trigger: type "@" shows file suggestions from workspace
- ContextChips: attached files shown as removable chips above textarea
- Drag-drop zone: drop files from system adds them as context
- Action bar below: Model selector + Thinking level + Send + Stop
- Send: `Cmd+Enter` or button click
- Stop: visible during streaming, aborts SSE + kills process

### 4.3 Right Panel

**EmptyState** — Shown when nothing selected.
- Subtle text: "Select a file or agent for details"

**FilePreview** — When a file is selected from explorer.
- File name + path header
- Syntax-highlighted content (PrismLight)
- Copy path button
- Insert into chat button

**AgentInfo** — When triggered from agent switcher or settings.
- Agent name, version, binary path
- Capability badges (skills, imageGen, fileOps, maxContext)
- Current session token usage
- Thinking level control

### 4.4 SettingsModal

Keep existing modal structure, polish styling:
- Agent list with capabilities
- Skills marketplace (existing)
- Theme toggle
- Workspace default
- Keyboard shortcuts reference

## 5. Data Flow

### State (all in page.tsx via useState)

```
agents: DiscoveredAgent[]          GET /api/agents
activeAgentId: string             selected agent
workspace: string                 working directory
conversations: ConvInfo[]         localStorage
activeConvId: string | null       current session
messages: Message[]               current conversation
streaming: boolean                is agent generating
sidebarOpen: boolean              sidebar visibility
rightPanelOpen: boolean           right panel visibility
rightPanelView: 'file' | 'agent' | null
selectedFilePath: string | null   file for preview
theme: 'dark' | 'light'           theme
```

### Key Interactions

```
Switch Agent      → setActiveAgentId → new ChatHeader + clear messages
Send Message      → POST /api/agent/chat → SSE → append to messages[]
Click File        → setSelectedFilePath → right panel opens → fetch content
@mention          → filter FileTree → show suggestions → insert path
Drag-Drop File    → read path from drop → add ContextChip
Stop Generation   → POST /api/agent/stop → abort SSE → kill process
Toggle Theme      → set data-theme attr on <html> → CSS cascade
Toggle Sidebar    → setSidebarOpen → CSS width transition
```

## 6. Implementation Phases

### Phase 1: Design Tokens & Layout Shell (foundation)
- New CSS token system (globals.css rewrite)
- Three-column layout structure
- Panel collapse/expand mechanics
- Font loading

### Phase 2: Sidebar Polish
- AgentSwitcher component
- Explorer section polish
- Conversations section polish
- Sidebar footer

### Phase 3: Main Chat Rebuild
- ChatHeader
- WelcomeScreen
- MessageList + Message (extract from current ChatPanel)
- Composer with @mentions + drag-drop
- ContextChips

### Phase 4: Right Panel
- FilePreview with syntax highlighting
- AgentInfo
- EmptyState
- Panel toggle integration

### Phase 5: Polish & Integration
- Animation passes
- Keyboard shortcuts
- SettingsModal polish
- Theme toggle refinement
- Edge cases & error states

## 7. Testing Strategy

- **E2E (Playwright):** Agent switching, send message, file tree navigation, panel toggle, theme toggle
- **Visual:** Screenshots at 320, 768, 1024, 1440
- **Accessibility:** Keyboard navigation, reduced-motion, contrast
- **Unit:** Token counting, markdown rendering, file path parsing

## 8. File Map

```
packages/web/
├── app/
│   ├── globals.css          ← REWRITE: new design tokens
│   ├── layout.tsx           ← MODIFY: three-column structure
│   └── page.tsx             ← MODIFY: new state, layout composition
├── components/
│   ├── Sidebar.tsx           ← REWRITE: AgentSwitcher + sections
│   ├── ChatPanel.tsx         ← SPLIT: into smaller components
│   ├── AgentSwitcher.tsx     ← NEW
│   ├── ExplorerSection.tsx   ← NEW (extract from Sidebar)
│   ├── ConversationsSection.tsx ← NEW (extract from Sidebar)
│   ├── ChatHeader.tsx        ← NEW
│   ├── WelcomeScreen.tsx     ← NEW
│   ├── MessageList.tsx       ← NEW (extract from ChatPanel)
│   ├── Message.tsx           ← NEW (extract from ChatPanel)
│   ├── Composer.tsx          ← NEW
│   ├── ContextChips.tsx      ← NEW
│   ├── RightPanel.tsx        ← NEW
│   ├── FilePreview.tsx       ← NEW
│   ├── AgentInfo.tsx         ← NEW
│   ├── MarkdownBody.tsx      ← KEEP, minor polish
│   ├── ThinkingBlock.tsx     ← KEEP, minor polish
│   ├── ToolCallBlock.tsx     ← KEEP, minor polish
│   ├── ToolResultBlock.tsx   ← KEEP, minor polish
│   ├── FileTree.tsx          ← KEEP, minor polish
│   ├── SettingsModal.tsx     ← POLISH
│   ├── Logo.tsx              ← KEEP
│   └── ModelSwitcher.tsx     ← KEEP
└── lib/                      ← NO CHANGES
```
