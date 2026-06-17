# pi++

[English](./README.md)

<img width="600" height="386" alt="final" src="https://github.com/user-attachments/assets/d66470e5-a324-4fb2-873f-298330cfcfee" />

Pi 编码智能体桌面工作区 — 原生 macOS 应用，为 Pi CLI 提供三栏式聊天界面。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## 为什么需要 pi++

Pi CLI 功能强大，但只限终端。pi++ 提供桌面界面：

- **独立对话** — 无需打开项目即可聊天，对话独立于文件夹存在
- **项目对话** — 关联文件夹的对话，自动加载上下文文件（AGENTS.md、CLAUDE.md）
- **ESC 清除** — 按 Escape 取消对话选中、收起项目、关闭面板
- **点击空白取消** — 侧栏空白处点击取消当前选中
- **三栏布局**：侧栏（对话 + 项目）、聊天面板、检查器
- **双向同步**：直接读写 Pi 原生文件（`auth.json`、`settings.json`、会话 `.jsonl`），无需额外数据库
- **OAuth 登录**：ChatGPT Plus/Pro、Anthropic Claude — 点击登录，浏览器自动打开
- **代理感知**：从 Finder 启动时自动检测 shell 配置文件中的代理设置
- **密钥验证**：非阻塞 — 网络不通也能保存，首次使用时再测试
- **模型管理**：按认证状态筛选模型，启用/禁用，设置默认
- **项目侧栏**：原生文件夹选择器，持久化项目列表，对话归属对应项目
- **Pi 设置编辑器**：结构化开关/输入，管理压缩、重试、信任、遥测
- **上下文文件预览**：查看 Pi 加载了哪些 AGENTS.md/CLAUDE.md
- **会话树**：浏览对话分支，分叉会话
- **会话导出**：下载对话为 HTML
- **快捷复制**：一键复制代码块、终端命令或完整消息
- **字体缩放**：动态调整整个界面字号的全局设置
- **Electron 外壳**：原生 macOS 应用，含菜单栏、Dock 图标

无独立数据库。无供应商锁定。数据存放在 `~/.pi/agent/`。

## 快速开始

**方式 A：下载预构建应用（无需终端）**

从 [Releases](../../releases) 下载最新 `.dmg`，打开后将 pi++ 拖入 Applications。

**方式 B：从源码构建**

```bash
git clone https://github.com/bengilla/pi-plus-plus.git pi++
cd pi++
npm install
npm run app:build
open release/mac-arm64/pi++.app
```

**前置条件：** Node.js 20+、npm 10+、macOS 14+（Apple Silicon）。

需要 Pi CLI（`npm install -g pi-coding-agent`）。首次启动时应用会引导安装。

## Loop — 自动修复

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
|---------|---------|
| `package.json` 有 `typecheck` | `npm run typecheck` |
| `package.json` 有 `build` | `npm run build` |
| `go.mod` | `go build ./...` |
| `Cargo.toml` | `cargo build` |

也可以手动创建 `.pi/verify.sh` 自定义验证逻辑。

**无需额外安装。** Loop 完全由 pi++ 内置的 API 端点驱动，使用项目已有的 pi CLI。

## 开发

```bash
npm install
npm run dev          # Web 开发服务器 → http://localhost:31508
npm run app:dev      # Electron 开发模式（自动重载）
npm run app:build    # 生产构建 .dmg → release/
```

### 技术栈

| 层 | 技术 |
|---|------|
| UI | Next.js 16 (Turbopack) + React 19 |
| 样式 | Tailwind CSS 4 + CSS 自定义属性 |
| 桌面 | Electron 33 |
| 智能体 | Pi CLI（子进程 spawn） |
| 存储 | `~/.pi/agent/`（auth.json、settings.json、.jsonl 会话文件） |

### 架构

```
┌──────────────────────────────────────┐
│ Electron App                         │
│  ┌────────────────────────────────┐  │
│  │ Next.js UI（三栏）              │  │
│  │ 侧栏 │ 聊天 │ 右侧面板          │  │
│  └──────────┬─────────────────────┘  │
│             │ HTTP APIs (SSE 流)     │
│  ┌──────────▼─────────────────────┐  │
│  │ Pi CLI（spawn() 子进程）       │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │ 双向读写
     ~/.pi/agent/
     ├── auth.json       # API 密钥
     ├── settings.json   # 模型配置、思维级别
     └── sessions/       # .jsonl 对话文件
```

### 项目结构

```
packages/
├── web/                  # Next.js 应用
│   ├── app/api/          # API 路由（pi、agent、files、skills）
│   ├── components/       # ChatPanel、Sidebar、SettingsModal
│   ├── lib/agents/       # Pi 智能体发现、注册、spawn 适配
│   ├── lib/skills/       # 技能扫描器
│   └── lib/hooks/        # useConversations、useSettings
└── electron/             # Electron 外壳
    ├── main.js           # 应用生命周期、服务器启动
    └── preload.js        # IPC 桥接
```

### 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/pi/auth` | GET/POST | 供应商密钥（脱敏）、OAuth 登录、密钥验证 |
| `/api/pi/models` | GET/POST | 筛选后的模型列表 + 默认模型 |
| `/api/pi/settings` | GET/POST | 读写 `~/.pi/agent/settings.json` |
| `/api/pi/context-files` | GET | 扫描 AGENTS.md/CLAUDE.md（全局 + 项目 + 父级） |
| `/api/pi/sessions` | GET/DELETE/POST | 会话增删改查、分支分叉 |
| `/api/pi/sessions/sync` | POST | 同步 Pi 会话 → localStorage |
| `/api/pi/session/export` | GET | 通过 `pi --export` 导出会话为 HTML |
| `/api/agent/chat` | POST | Pi CLI SSE 流式输出 |
| `/api/agent/stop` | POST | 停止运行中的智能体 |
| `/api/loop` | POST | SSE 流：自动修复循环（maker/checker 阶段） |

### 设计 Token

- 强调色：`oklch(72% 0.12 175)`（pi 绿）
- 按钮：绿色边框 + 绿色文字 + 透明背景 + 直角
- Header：42px 统一高度

## 贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

标记为 `good-first-issue` 的 Issue 适合首次贡献。特别欢迎以下领域的贡献：

- **跨平台**：Windows/Linux 支持（Electron 打包）
- **主题**：更多配色方案（超越浅色/深色）
- **侧栏筛选**：搜索、日期范围、标签系统
- **思考块可视化**：可折叠推理展示
- **工具调用 UX**：内联工具执行预览、取消运行中的工具
- **会话重连**：恢复中断的 Pi 会话
- **测试**：端到端测试、集成测试、视觉回归测试

## 许可证

MIT — 详见 [LICENSE](./LICENSE)。
