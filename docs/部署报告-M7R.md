---
# M7R 部署报告

> 提交日期：2026-08-03
> 部署类型：增量更新（M7 Windows 桌面壳所需的 Web 端支持）到已在线的 M4 生产环境

---

## 部署概况

项目名称：全平台便签（Web MVP）

部署路径：`/home/ubuntu/projects/sticky-notes`

更新方式：rsync 增量同步（无 `--delete`，排除 `.env`、`data/`、`uploads/`、`*.db`、`.next/`、`node_modules/`、`.git/`、`src-tauri/`、`.github/`、`shell-static/`、`.claude/`、`.cargo/`、`target/`）

服务名称：`sticky-notes.service`（systemd --user）

监听地址：`127.0.0.1:9002`

访问域名：`https://notes.hello-mylife.online`

本次更新内容（M7 Windows 桌面壳的 Web 端支持，纯前端，无 schema 变更）：
- `/login` 支持 `returnTo` 参数，登录成功后安全回跳（`safeReturnTo` 防开放重定向）
- floating 页未登录时重定向到 `/login?returnTo=/notes/{id}/floating`，登录后跳回原悬浮窗
- floating 页 401 处理：自动跳转带 `returnTo` 的登录页
- 新增 `src/lib/tauri.ts`：Tauri 环境检测（`__TAURI_INTERNALS__`）+ 三个命令封装（`open_floating_note` / `toggle_always_on_top` / `get_always_on_top`）
- NoteEditor 新增“在悬浮窗中打开”按钮（仅 Tauri 环境显示）
- floating 工具栏新增置顶切换按钮（仅 Tauri 环境显示）
- `package.json` 新增 `@tauri-apps/api`（dependencies）与 `@tauri-apps/cli`（devDependencies），本次在服务器执行 `npm ci` 安装

---

## 变更前准备

### 备份（M4 §11 强制）

已备份至：`/home/ubuntu/backups/sticky-notes-20260803003847`

| 内容 | 大小 |
|------|------|
| `.env` | ✔ |
| `data/`（prod.db） | ✔ |
| `uploads/` | ✔ |
| Caddyfile | ✔ |
| 合计 | 6.8 MB |

### rsync 预演（dry-run）

- 15 个文件待同步，全部为本次 Web 改动 + 相关文档
- 确认 `.env`、`data/`、`uploads/`、`*.db`、`.next/`、`node_modules/` 及新增的 `src-tauri/`、`.github/`、`shell-static/` 均不会被覆盖

---

## 健康检查结果

| 检查项 | 结果 |
|--------|------|
| HTTPS 域名访问 | 307 → /login ✔ |
| 本地 curl 127.0.0.1:9002 | 307 → /login ✔ |
| 登录接口（正确凭据） | 200 ✔ |
| 登录接口（错误凭据） | 401 ✔ |
| 未登录访问 /api/notes | 401 ✔ |
| 登录后访问 /api/notes | 200 ✔ |
| **M7：未登录访问 floating 页** | 307 → /login?returnTo=/notes/{id}/floating ✔ |
| **M7：登录后访问真实 note 的 floating 页** | 200，渲染 toolbar + 置顶按钮 ✔ |

构建结果：`npm ci` 成功，`npm run build` 成功，14 条路由生成（含 `/notes/[id]/floating`），类型检查通过。

---

## 部署中发现并处理的问题

### `.env` 密码值带引号导致测试命令误报 401（非生产回归）

**现象**：用 shell `cut` 从 `.env` 读取 `ADMIN_PASSWORD` 后 curl 登录返回 401。

**根因**：`.env` 中密码值本身带首尾双引号（如 `ADMIN_PASSWORD="1xxxxxx"`）。Next.js 运行时通过 dotenv 解析引号得到真实值，而 shell `cut` 取到的是含引号的原始字符串，`bcrypt.compare` 自然失败。这是**测试命令问题**，生产登录一直正常。

**处理**：读取时用 `tr -d '"'` 去掉引号后重测，正确凭据 200、错误凭据 401，全部通过。

---

## 服务与日志

systemd 状态：**active (running)**，自 2026-08-03 00:40:02 CST 起无异常重启

```
Aug 03 00:40:02 ... systemd[1231]: Started sticky-notes.service - Sticky Notes Web App.
Aug 03 00:40:02 ... npm[3545891]:   ▲ Next.js 14.2.35
Aug 03 00:40:02 ... npm[3545891]:   ✓ Ready in 345ms
```

---

## 回滚方案

若需回滚至部署前状态：

```bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user stop sticky-notes.service
# 恢复备份 /home/ubuntu/backups/sticky-notes-20260803003847 中的 .env、data/、uploads/、Caddyfile
# 代码回滚：需恢复旧版本 src/ 源码并重新构建
npm ci && npm run build
systemctl --user start sticky-notes.service
```

注意：本次无 schema 变更，回滚不涉及数据库结构。

---

## 剩余风险

1. **无 Git 历史**：服务器上代码仍无 `.git` 目录，更新依赖 rsync。建议在服务器初始化 Git 仓库。
2. **Tauri 壳内行为需 Windows 实机验收**：置顶按钮的 invoke 命令、悬浮窗打开流程依赖壳内环境，Mac 上仅验证了 Web 端渲染与重定向逻辑，壳内完整交互需 Windows 实机或 CI 产物确认。
3. **无监控告警**：仍无进程宕机自动通知。
