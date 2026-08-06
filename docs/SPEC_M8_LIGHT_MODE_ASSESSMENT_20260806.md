# 亮色模式适配评估清单（M8-R5-F03）

日期：2026-08-06
范围：**仅评估，不含实现**。技术部先提交评估清单，产品确认后再进入实现阶段。

---

## 1. 现状：主题架构

| 层 | 位置 | 说明 |
|---|---|---|
| 颜色 token | `tailwind.config.ts` | 26+ 个 token，全部为暗色值（page.bg `#191919`、sidebar.bg、toolbar.bg、panel.bg、border.light、ink 三级、primary、danger、success、accent/sel/tint × 5 色、search.bg rgba 白） |
| CSS 变量 | `src/app/globals.css` `:root` | 12 个变量（--page-bg / --sidebar-bg / --toolbar-bg / --panel-bg / --border-light / --ink / --ink-secondary / --ink-muted / --primary / --danger / --success / --selection-yellow）镜像 token |
| 组件 | `src/components/*` (13 个) + 应用壳 | 绝大多数使用 token class（`bg-page-bg`、`text-ink-muted`、`border-border-light`），**跟随 token 走** |
| 特殊值 | globals.css | focus-visible 描边 `#D9B73A`、scrollbar 滑块 `#4A4142` / 悬停 `#62595A` |
| 桌面壳 | Tauri Windows | 透明标题栏区域依赖 window 背景，主题切换不得破坏 |

**结论**：已有 CSS 变量层，亮色模式可行"变量覆盖"方案（见 §5），无需重写组件。

---

## 2. 硬编码颜色统计（不跟随 token，必须逐个改造）

### 2.1 TSX 内任意值 hex —— 10 处 / 4 文件

| 颜色 | 次数 | 位置 | 用途 | 亮色影响 |
|---|---|---|---|---|
| `#E3C24A` | 6 | ChecklistEditor ×5、NoteEditor ×1 | 缩进引导线 / 拖动柄 / 勾选指示 | 等于 accent-yellow token，**主题中性**；仅需改为 token 去重 |
| `#1A1A1A` | 1 | ChecklistEditor | 黄底勾选框上的文字 | 主题中性，亮色可用 |
| `#C7C7CC` | 2 | FloatingNoteClient | 标题 + 正文 placeholder | **亮色下偏浅**，需改 token（placeholder-ink-muted） |
| `#2A2527` | 1 | ContextMenu | 菜单面板底色 | 需改 token |

### 2.2 globals.css 功能色 —— 3 处

| 颜色 | 用途 | 亮色影响 |
|---|---|---|
| `#D9B73A` | :focus-visible 描边 | 需亮色变体（加深） |
| `#4A4142` / `#62595A` | scrollbar 滑块 / 悬停 | 需亮色变体（变浅） |

### 2.3 白/黑透明度叠层（暗色模式专属写法，改造重点）—— 约 40 处

| 模式 | 次数 | 用途 | 亮色处理 |
|---|---|---|---|
| `bg-white/[0.045~0.10]` | ~25 | 行/按钮 hover、active、header 按钮 | 翻转为 `bg-black/[0.04~0.08]` |
| `bg-white/20`、`/35` | 3 | 激活态、skeleton | 翻转 |
| `ring-white/10`、`/45`、`border-white/5`、`/10` | 13 | 图片卡焦点环 + 分隔线 | 翻转黑系 |
| `hover:bg-black/[0.04]` | 4 | FloatingNoteClient 按钮 hover | 已是黑叠层，亮色直接可用 |
| `bg-black/75/70/60/55` | 4 | 图片预览遮罩 + 缩放按钮 | **主题中性，保留**（深色遮罩两种模式都合理） |
| `text-white/40/60/70` | 4 | 彩色底上的文字 | 主题中性，保留 |

### 2.4 纯色 white/black

| 类 | 次数 | 用途 | 亮色处理 |
|---|---|---|---|
| `bg-white` | 39 | 叠层 hover（占多数）、浮窗 loading 底（`min-h-screen bg-white`，亮暗皆可） | 叠层部分翻转 |
| `text-white` + `text-white/xx` | 26 | 彩色 accent / 危险按钮 / 缩放按钮上的文字 | 主题中性，保留 |
| `bg-black` | 11 | 多为 `bg-black/[0.03~0.04]` hover | 保留 |
| `ring-white` / `border-white` | 13 | 图片卡边框 | 翻转 |
| `border-black` | 2 | — | 视上下文 |

---

## 3. 需改造组件清单（10 个）

| 组件 | 涉及点 | 改造量 |
|---|---|---|
| NoteList / trash 页 | 行 hover `bg-white/[0.045]` | 小 |
| NoteEditor | 工具栏 hover/active、色块激活态 | 中 |
| ContextMenu | 面板底色 `#2A2527`、项 hover | 小 |
| ChecklistEditor | `#E3C24A` 指示 → token | 小 |
| FloatingNoteClient | placeholder `#C7C7CC`、hover | 小 |
| ImageAttachments / ImagePreview | 卡底色、遮罩（遮罩保留） | 小 |
| Sidebar / AccountMenu / ConfirmDialog / ColorPicker / SaveStatus | 基本全 token，仅核查 | 小 |
| app 壳（首页 header、skeleton） | hover、skeleton 底色 | 小 |

总量：**10 个组件，绝大多数改动是替换叠层 class**，无逻辑改动。

---

## 4. 工作量预估

推荐 **方案 A：CSS 变量覆盖**（利用现有变量层，不迁移全部 token class）：

| 步骤 | 内容 | 预估 |
|---|---|---|
| 1 | globals.css 增加亮色变量集（覆盖 12 个 `:root` 变量 + 3 个功能色） | 0.5 天 |
| 2 | 将 §2.3 的 ~40 处白叠层抽成 2~3 个语义 utility（`surface-hover` / `surface-active` / `surface-card`），一次替换 | 1 天 |
| 3 | 4 处任意值 hex 改 token；search.bg 变量适配 | 0.5 天 |
| 4 | 主题开关 + localStorage 持久化 + 首次按 `prefers-color-scheme` | 0.5 天 |
| 5 | 双模式 QA（桌面壳 + 浮窗 + 回收站 + 图片预览） | 0.5 天 |

**合计约 3 个工作日**。已上线功能不受影响，改动集中在样式层，风险低。

---

## 5. 风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| 漏改硬编码叠层 | 个别页面亮色下 hover 看不清 | 以本文 §2 清单为核对表全量 grep 覆盖 |
| 浮窗独立页面 | FloatingNoteClient 是独立路由，需同步读取主题 | 同源 localStorage 天然可用 |
| 桌面壳透明区域 | Tauri 透明标题栏依赖 body 背景色 | 主题变量改动 body 背景时保留透明属性 |
| search.bg 白值 | 亮色下搜索框需反转为深色输入框 | 变量一并覆盖 |
| 图片预览深色遮罩 | 设计意图即深色，两种模式统一 | 明确为"不随主题" |

## 6. 待产品确认

1. **默认主题**：新用户首次是亮色还是暗色？（建议：跟随系统）
2. **是否在 M8 收尾前插入**，还是排入下一里程碑？
3. 勾选指示色 `#E3C24A` 是否在亮色下加深一档，以保持对比度？（建议：亮色下加深）
