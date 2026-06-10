# Pi Workspace — 开发记录

> agents-web 改造为 Pi 专属工作区  
> 2026-06-10 | commit `60d3584`

## 架构

```
Next.js 16 (Turbopack) + React 19 + Tailwind CSS 4
端口 31508 | TypeScript strict | 纯离线可用
```

```
packages/web/
├── app/api/pi/
│   ├── model/route.ts        # 读取当前 defaultModel
│   ├── models/route.ts       # pi --list-models 全部54个模型
│   ├── sessions/route.ts     # 读取 Pi CLI 会话列表
│   └── version/route.ts      # 版本检查 + 更新
├── lib/agents/               # Pi agent 适配层
│   ├── registry.ts           # 唯一定义 Pi (6→1)
│   ├── spawn.ts              # 进程管理 + parsePiLine
│   └── adapters/factory.ts   # 适配器工厂
└── components/
    ├── Sidebar.tsx            # 三栏左侧: π Pi + 文件树 + 对话
    ├── ChatPanel.tsx          # 中间: 聊天 + 模型选择 + thinking
    ├── RightPanel.tsx         # 右侧: 文件/AI 详情
    ├── SettingsModal.tsx      # 设置: 模型/会话/技能/通用
    └── ...
```

## 功能清单

### 聊天
- [x] SSE 流式输出 (Pi JSON 模式)
- [x] 模型选择下拉 (54模型，provider 分组)
- [x] Thinking 7 级控制 (Auto~XHigh，按钮组)
- [x] 图片粘贴 / 文件拖拽 / @文件引用
- [x] 输入历史 (50条，↑↓ 浏览)
- [x] 计划模式 (目标/步骤/参考/验收)
- [x] 会话持久化 (localStorage，项目级隔离)
- [x] Pi CLI 会话自动保存 + 连续性

### 设置
- [x] Models — 全部模型 + 开关 (scoped) + 能力标签 (Text/Reasoning/Vision)
- [x] Sessions — 当前项目 Pi CLI 会话列表
- [x] Skills — 已安装/市场技能管理
- [x] General — 语言/字体缩放
- [x] 版本检查 + 更新弹窗

### UI
- [x] Pi 绿色系 (#accent: oklch 72% 0.12 175)
- [x] 三栏 42px header 统一
- [x] 工具调用分组 + 进度动画 + 自动折叠
- [x] 启动 splash 动画 (π pulse)
- [x] 无圆角按钮 (直角风格)
- [x] 绿色边框 + 文字 + 透明背景

### API
| 端点 | 功能 |
|---|---|
| GET /api/pi/model | 当前默认模型 |
| GET /api/pi/models | 全部可用模型列表 |
| POST /api/pi/models | 设置默认/切换 scoped |
| GET /api/pi/sessions | Pi CLI 会话列表 |
| GET /api/pi/version | 版本检查 |
| POST /api/agent/chat | 对话 (支持 model/sessionId) |
| POST /api/agent/stop | 停止 |

## 下一步

- [ ] 工具配置 (enable/disable tools)
- [ ] 会话恢复 (从 Sessions 继续对话)
- [ ] System prompt 自定义
- [ ] Electron 桌面壳
- [ ] 分支改名 (codex → pi)

## 运行

```bash
cd agents-web
npm run dev          # http://localhost:31508
npm run build        # 生产构建
npm run start        # 生产运行
```
