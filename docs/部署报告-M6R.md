---
# M6R 部署报告

> 提交日期：2026-08-03
> 部署类型：增量更新（M6R 修复）到已在线的 M4 生产环境

---

## 部署概况

项目名称：全平台便签（Web MVP）

部署路径：`/home/ubuntu/projects/sticky-notes`

更新方式：rsync 增量同步（无 `--delete`，排除 `.env`、`data/`、`uploads/`、`*.db`、`.next/`、`node_modules/`、`.git/`）

服务名称：`sticky-notes.service`（systemd --user）

监听地址：`127.0.0.1:9002`

访问域名：`https://notes.hello-mylife.online`

本次更新内容：
- F01：Enter 新建待办（修复焦点离开清单时误删新空行的竞态）
- F02：直接粘贴多行文本自动拆分为待办（含 `1.`/`[x]`/`☑` 等标记清洗）
- F03：编辑态下新建入口保持可见
- F04：移除红绿灯 macOS 窗口按钮
- F05：账户入口 + 菜单（登录/退出）
- F06：窄窗口工具栏不再横向溢出（320px 级验证）
- F07：色卡调亮 + 列表卡片颜色反馈

---

## 变更前准备

### 备份（M4 §11 强制）

已备份至：`/home/ubuntu/backups/sticky-notes-20260802235845`

| 内容 | 大小 |
|------|------|
| `.env` | 345 B |
| `data/`（prod.db） | 目录级备份 |
| `uploads/` | 目录级备份 |
| Caddyfile | 1.8 KB |

### rsync 预演（dry-run）

- 96 个文件待同步，确认排除清单生效
- 确认 `.env`、`data/`、`uploads/`、`*.db`、`.next/`、`node_modules/` 均不会被覆盖

---

## 健康检查结果

| 检查项 | 结果 |
|--------|------|
| HTTPS 域名访问 | 307 → /login ✔ |
| 本地 curl 127.0.0.1:9002 | 307 → /login ✔ |
| 登录接口（正确凭据） | 200 ✔ |
| 登录接口（错误凭据） | 401 ✔ |
| 未登录访问 /api/notes | 401 ✔ |
| 新建便签 | 200 ✔ |
| 新建待办便签（checklist 数据） | 200 ✔ |
| 待办勾选（PATCH） | 200 ✔ |
| checklistGroups 持久化往返 | 200 ✔ |
| 软删除 + 永久删除 | 200 ✔ |
| 回收站列表 | 200 ✔ |
| 数据库完整性 PRAGMA | ok ✔ |
| Hermes Backend 8000 | 正常（未受影响）✔ |
| Hermes Dashboard 9119 | 200（未受影响）✔ |

---

## 部署中发现并处理的问题

### Schema 变更（非预期，已处理）

**现象**：新建便签接口返回 `INVALID_REQUEST`（400）。

**根因**：M6 迭代新增了 `checklistGroups` 列，但该 schema 变更此前**从未应用到生产数据库**。旧生产代码（M4 时代）不引用该列所以一直正常；本次同步的 M6R 代码引用了它，`prisma.note.create()` 即报 `P2022: The column checklistGroups does not exist`。

**处理**：比对确认差异为**纯增量**（仅缺 `checklistGroups String @default("[]")` 一列），执行：

```bash
cd /home/ubuntu/projects/sticky-notes
npx prisma db push --accept-data-loss=false
```

`--accept-data-loss=false` 保证任何破坏性变更会被拒绝；该命令仅新增一列（有默认值），不影响既有数据。执行后验证列已存在、全部接口恢复正常。

**教训**：后续迭代若有 schema 变更，部署计划必须包含 `prisma db push` 步骤，不能仅凭"代码无 schema 改动"判断。

---

## 服务与日志

systemd 状态：**active (running)**，自 2026-08-02 23:59:47 CST 起无异常重启

Caddy 状态：**active (running)**，TLS 证书正常

```
Aug 02 23:59:47 ... systemd[1231]: Started sticky-notes.service - Sticky Notes Web App.
Aug 02 23:59:48 ... npm[3534857]: > next start
Aug 02 23:59:48 ... npm[3534869]:   ▲ Next.js 14.2.35
Aug 02 23:59:48 ... npm[3534869]:   ✓ Ready in 340ms
```

构建结果：`npm run build` 成功，11/11 静态页面生成，类型检查通过。

---

## 回滚方案

若需回滚至部署前状态：

```bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user stop sticky-notes.service
# 恢复备份 /home/ubuntu/backups/sticky-notes-20260802235845 中的 .env、data/、uploads/、Caddyfile
# 代码回滚：需恢复旧版本 src/ 源码并重新构建
npm ci && npm run build
systemctl --user start sticky-notes.service
```

注意：schema 已添加 `checklistGroups` 列（带默认值），即使回滚代码该列也无害；旧代码不引用它。

---

## 剩余风险

1. **无 Git 历史**：服务器上代码仍无 `.git` 目录，更新依赖 rsync。建议在服务器初始化 Git 仓库。
2. **本次 schema 变更靠人工发现**：部署后发现列缺失。建议后续在部署计划中固定加入"比对 prisma schema 与生产库结构"步骤。
3. **无监控告警**：仍无进程宕机自动通知。
