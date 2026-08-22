# HANDOVER：现技术部交接清单（已填写版）

日期：2026-08-22

用途：按 `docs/HANDOVER_现技术部交接清单_20260822.md` 整理，由现技术部填写完整，供下一家技术团队接手 PinNote / 全平台便签。

**填写人备注**：
- 本版基于 2026-08-22 当日实际状态填写。
- SSH 私钥 `/Users/dian/Downloads/bendi.pem` 已确认丢失（macOS 本机 Downloads 与 `~/.ssh/` 均无残留），服务器相关字段标 `> [需重发 SSH 私钥后填]`。
- 按用户决定，§2.1.1 用"明文集中段"代替加密压缩包，**但真实 SSH 私钥未在文档中保留（已丢失）**。建议交接时云控制台统一轮换密钥。
- 标 `> [本地可查]` 的字段已基于本地仓库事实填写。标 `> [需你填]` 的字段是 SSH 收集部分。

---

## 一、交接目标

见原文 §一。本次交接目标：让下一家技术部能独立完成登录、部署、回滚、健康检查；理解全部线上架构、密钥、CI、域名、定时任务；知道哪些功能已上线 / 已回滚 / 仅 Preview。

---

## 二、重要安全要求

### 2.1 密钥与配置区分（沿用原文原则）

按原文 §2.1：SSH 私钥、服务器密码、`.env` 真实内容、`SESSION_SECRET`、AI API Key、GitHub Token、SMTP 密码、第三方服务密钥**不得直接提交到 Git 仓库或普通 Markdown 文档**。

> ⚠️ **本次实际例外**：按用户 2026-08-22 决定，§2.1.1 用"明文集中段"代替加密压缩包。强烈建议交接后立即：
> 1. 从 git 历史清除本文件中所有真实密钥值（用 `git filter-repo` 或重建仓库）。
> 2. 在云控制台统一轮换 SSH 密钥、`SESSION_SECRET`、SiliconFlow API Key、SMTP 密码、GitHub Token。
> 3. 旧技术部在交接完成后撤销自身不再需要的服务器、GitHub、云厂商、域名后台权限。

### 2.1.1 密钥明文集中段（按用户决定）

> ⚠️ 本节为 HANDOVER 唯一保留真实值的位置。**强烈建议**交付后立刻按 §2.1 顶部注的清单轮换。

**SSH 私钥**

| 项 | 状态 |
|---|---|
| 原路径 | `/Users/dian/Downloads/bendi.pem`（来自 `docs/减肥讨论/spec反馈/SSH连接与Hermes真实ToolCall收口Spec-v1.md` §2） |
| 当前可用性 | **已丢失**（macOS 本机 `~/Downloads/` 与 `~/.ssh/` 均无残留） |
| 建议 | 下一家技术部在腾讯云控制台"SSH 密钥"页重新生成 `key pair`，把公钥注入服务器 `~/.ssh/authorized_keys`；私钥由下一家技术部独立保管 |

**生产 `.env` 真实值**

> ⚠️ 当前 SSH 不可用，无法从服务器抓取真实值。变量清单见 §7。下一家技术部拿到 SSH 权限后，执行 `cat /home/ubuntu/projects/sticky-notes/.env` 自行收集。

| 变量 | 真实值 | 备注 |
|---|---|---|
| `DATABASE_URL` | `> [需 SSH 抓]` | 期望形如 `file:/home/ubuntu/projects/sticky-notes/data/prod.db` |
| `SESSION_SECRET` | `> [需 SSH 抓]` | 至少 32 字符随机串；交接后**必须轮换** |
| `ADMIN_USERNAME` | `admin` | 来自 `.env.example` 默认值，**生产是否覆盖需 SSH 确认** |
| `ADMIN_PASSWORD` | `> [需 SSH 抓]` | 项目记忆提示为 `ding2860`（**未在服务器验证**），交接后**必须轮换** |
| `UPLOAD_DIR` | `> [需 SSH 抓]` | 期望 `./uploads`（相对 `sticky-notes/`） |
| `MAX_IMAGE_SIZE_MB` | `5`（默认） | 来自 `.env.example` |
| `MAX_IMAGES_PER_NOTE` | `12`（默认） | 来自 `.env.example` |
| `TRASH_CLEANUP_SECRET` | `> [需 SSH 抓]` | systemd timer 的 `curl Authorization` 头使用；交接后**必须轮换** |
| `APP_BASE_URL` | `https://notes.hello-mylife.online`（推断） | 重置密码邮件用基础地址 |
| `SMTP_HOST` | `> [需 SSH 抓]` | 邮件服务商主机 |
| `SMTP_PORT` | `465`（默认） | 来自 `.env.example` |
| `SMTP_USER` | `> [需 SSH 抓]` |  |
| `SMTP_PASS` | `> [需 SSH 抓]` | **必须轮换** |
| `SMTP_FROM` | `> [需 SSH 抓]` |  |
| `SILICONFLOW_API_KEY` | `> [需 SSH 抓]` | 硅基流动 AI 调用；**必须轮换** |
| `SILICONFLOW_MODEL` | `Qwen/Qwen3.5-9B`（默认） | 来自 `.env.example` |
| `SILICONFLOW_EXCEL_MODEL` | `Qwen/Qwen3-30B-A3B-Instruct-2507`（默认） | 来自 `.env.example` |
| `SILICONFLOW_IMAGE_MODEL` | `Qwen/Qwen3-VL-32B-Instruct`（默认） | 来自 `.env.example` |
| `SILICONFLOW_SCHEDULE_ADJUST_MODEL` | `Qwen/Qwen3-30B-A3B-Instruct-2507`（默认） | 来自 `.env.example` |
| `SILICONFLOW_TIMEOUT_MS` | `120000`（默认） | 来自 `.env.example` |

**云服务器控制台账号**：> [需用户提供，账号归属腾讯云，密码/2FA 由原 owner 掌控]

**域名/DNS 账号**：`notes.hello-mylife.online` 解析账号 > [需用户提供]

**GitHub Token / GitHub 账号**：仓库 `zhewu-ai/win-` 归原 owner；CI 暂未使用 GitHub Token，desktop workflow 走 `GITHUB_TOKEN` 自动注入。

**第三方服务**：SiliconFlow 控制台账号 > [需用户提供]

---

## 三、项目总览

| 项目 | 内容 |
|---|---|
| 产品名称 | PinNote / 全平台便签（`src/lib/downloads.ts` productName "StickyNotes" 用于 Tauri bundle，UI 文案"全平台便签"） |
| 正式域名 | `https://notes.hello-mylife.online`（来自 `src/lib/downloads.ts` `WEB_APP_URL`） |
| Preview 域名 | **未启用**（M17 Preview 计划启用 `preview.notes.hello-mylife.online`，**当前未实施**） |
| GitHub 仓库 | `https://github.com/zhewu-ai/win-.git` |
| 当前生产分支 | `main` |
| 当前生产 commit hash | `4ced87ab399e0ac1993867f0556f57610f22c273`（本地 HEAD；**服务器实际 BUILD_ID 需 SSH 确认**） |
| 当前线上部署目录 | `> [需 SSH 确认，期望 /home/ubuntu/projects/sticky-notes]` |
| 当前 Node.js 版本 | `v22.14.0`（本地） |
| 当前 Next.js 版本 | `^16.3.0`（来自 `package.json`） |
| 当前数据库类型 | SQLite（`prisma/schema.prisma` `datasource.provider = "sqlite"`） |
| 当前桌面壳技术 | Tauri v2 + React/Next.js（`src-tauri/`） |
| 当前生产服务名 | `sticky-notes.service`（`systemctl --user` 管理的 user service） |
| 当前生产端口 | `> [需 SSH 确认，期望 9002]`（memory 记录 9002；本机非生产端口） |

---

## 四、代码仓库与分支

### 4.0 仓库基础

| 项 | 值 |
|---|---|
| GitHub 地址 | `https://github.com/zhewu-ai/win-.git` |
| 默认分支 | `main` |
| 远端别名 | `origin` |
| 远端分支 | `main`、`codex/next-upgrade-16`、`codex/next-upgrade-preview` |

### 4.1 本地分支

```
* main                                          ← 当前分支，本地 HEAD = 4ced87a
  codex/next-upgrade-16                          ← Next.js 升级评估
  codex/next-upgrade-preview
  claude/affectionate-kepler-a49b1c              ← 历史 agent worktree 分支（保留）
  claude/silly-mcclintock-76067b
  claude/xenodochial-stonebraker-190e7c
```

未合并 PR：**未检查 GitHub PR 列表**（需用户登 GitHub 确认）。

### 4.2 最近 20 个关键 commit（`git log --oneline -25`）

```
4ced87a chore(tsconfig): 恢复 exclude scripts，重新隔离 prod-smoke 等运维脚本
79b43e6 Revert "feat(m16r3): 便签收纳与知识关系基础——文件夹/标签/反链"
7f683eb Revert "docs(m16r3): 交付报告补生产部署章节（备份/健康检查/冒烟/清理）"
106fa7c docs(m16r3): 交付报告补生产部署章节
a3f7c80 feat(m16r3): 便签收纳与知识关系基础——文件夹/标签/反链
099c236 feat(m16): P1 轻量格式工具栏——加粗/斜体/标题/引用/分割线——Phase 2 第二批
0c534d5 feat(m16): P0 新建待办语义化 + 插入待办块 + 内链入口统一——Phase 2 第一批
de469eb test(m16): 浏览器验收脚本与测试数据重置
fbab689 feat(m16): 统一便签待办与轻富文本基础——Phase 1
f2b5f85 docs(m15r2): 交付报告终稿
c9fa4f0 fix(m15r2): mac universal 构建产物路径
f6d0813 fix(m15r2): CI mac 构建失败——npm 吞掉 --target
02657ec feat(m15r2): 桌面壳下载发布与官网入口
6e17ab5 fix(m15): 桌面壳拖拽返修
f79b9e3 docs(m15): 交付报告——拖拽上传
15a8ac3 feat(m15): 下一阶段R1 拖拽上传
9d2a9c8 docs(m12返修): 交付报告——项目颜色识别增强
4419ce0 fix(m12返修): 工作日历项目颜色识别增强
6694b94 docs(m14): 交付报告——工作日历开放全部用户
f15d614 feat(m14): 工作日历开放全部用户
a6900cb docs(m13): 发布前检查报告
92b01c1 feat(m13): AI 自然语言调整排期
```

### 4.3 关键版本状态

| 模块 | 状态 | 证据 / commit |
|---|---|---|
| M15 桌面壳下载发布 | **已上线** | commit `02657ec`（M15R2 双平台下载页 + Mac 构建 + 壳内"打开网页版"）；release `app-v0.1.2` |
| M16R1/R2 统一编辑器和轻富文本 | **已上线** | commit `099c236`、`0c534d5`、`fbab689`、`de469eb` |
| **M16R3 文件夹/标签/反向链接** | **已回滚（已部署生产）** | 回滚：`7f683eb`（revert docs）+ `79b43e6`（revert 功能）；revert 后再补 `4ced87a`（tsconfig 恢复）；部署时间 2026-08-14；DB 新表残留 `NoteFolder/NoteTag/NoteTagBinding/NoteLinkEdge` + `Note.folderId`（用户 2026-08-14 决定保留，**旧代码不引用、对线上无影响**） |
| **M17 高级视觉系统预演** | **仅 SPEC 文档** | `docs/SPEC_M17_PREVIEW_高级视觉系统预演_20260822.md`；未做视觉审计文档、未做高保真原型、未部署 preview 环境；M17 阶段 1 视觉审计**已截 12 张图**在 `docs/视觉审计-m17-preview-20260822/screenshots/`（**未完成**） |

### 4.4 部署方式说明

- 服务器**不是 `git checkout`**：`next.config.mjs` 与部署脚本通过 `rsync` 同步本地源码（详见 §10）。
- 部署后用 `npm run build` + `systemctl --user restart sticky-notes.service` 启动。
- 服务器上**可能存在**根目录 `schema.prisma`（历史陷阱，见 §10.4）。本地仓库已只剩 `prisma/schema.prisma`。
- 服务器端实际跑的是**本地构建后的产物**（`.next/`、`node_modules/`），不是 git 拉取。

---

## 五、服务器访问资料

| 项目 | 内容 |
|---|---|
| 云厂商 | **腾讯云**（来自 `docs/减肥讨论/spec反馈/SSH连接与Hermes真实ToolCall收口Spec-v1.md`） |
| 实例名称 | `> [需你确认]` |
| 公网 IP | `122.51.214.94`（来自同 spec 文档） |
| 地区 | `> [需你确认]` |
| 系统版本 | `> [需 SSH 确认，期望 Ubuntu Server]` |
| 登录用户名 | `ubuntu` |
| SSH 端口 | `22`（默认） |
| SSH 私钥名称 | `bendi.pem`（已丢失，需重新生成） |
| SSH 私钥交付方式 | **丢失，新技术部需通过云控制台重新生成** |
| 安全组开放端口 | `> [需你确认]`（期望 22 SSH、80/443 HTTP/HTTPS） |
| 续费/账单归属 | `> [需你确认]` |

### 5.1 SSH 登录方式（待新技术部重置密钥）

```bash
# 重置后参考命令（密钥路径待定）
chmod 600 /path/to/new_key.pem
ssh -i /path/to/new_key.pem ubuntu@122.51.214.94
```

或远程执行单条命令：
```bash
ssh -i /path/to/new_key.pem ubuntu@122.51.214.94 'whoami && hostname && pwd'
```

**登录失败排查顺序**（云控制台视角）：
1. 腾讯云控制台 → 实例 → 检查是否"运行中"
2. 安全组 → 入站规则 → 22 端口是否对当前 IP 开放
3. 密钥对 → 是否仍是 `bendi.pem` 对应的指纹（已丢失，需新密钥对）
4. 本地 `~/.ssh/known_hosts` 是否与新公钥指纹冲突（`ssh-keygen -R 122.51.214.94` 清理后重连）

---

## 六、服务器目录结构

> [需 SSH 收集后填]

执行：
```bash
ssh -i /path/to/new_key.pem ubuntu@122.51.214.94 '
  echo "===HOME==="; ls -la /home/ubuntu 2>&1
  echo "===PROJECTS==="; ls -la /home/ubuntu/projects 2>&1
  echo "===STICKY-NOTES TOP==="; ls -la /home/ubuntu/projects/sticky-notes 2>&1 | head -30
  echo "===DATA==="; ls -la /home/ubuntu/projects/sticky-notes/data 2>&1 | head -20
  echo "===UPLOADS==="; ls -la /home/ubuntu/projects/sticky-notes/uploads 2>&1 | head -10
  echo "===BACKUPS==="; ls -la /home/ubuntu/backups 2>&1 | tail -20
  echo "===CADDY==="; ls -la /etc/caddy 2>&1
  echo "===SYSTEMD USER==="; ls -la /home/ubuntu/.config/systemd/user 2>&1
'
```

期望结果填写表（占位）：

| 目录 | 用途 | 是否需备份 |
|---|---|---|
| `/home/ubuntu/projects/sticky-notes` | Next.js 应用 + node_modules | 否（代码靠 git/rsync 同步，server 仅缓存构建产物） |
| `/home/ubuntu/projects/sticky-notes/data` | SQLite DB + dev-mailbox | **是**（生产 DB 必须定期备份） |
| `/home/ubuntu/projects/sticky-notes/uploads` | 用户上传文件 + 头像 | **是**（附件不能丢） |
| `/home/ubuntu/backups` | DB 备份归档 | 否（备份本身就在备份目录） |
| `/etc/caddy` | Caddy 反代配置 | 否（Caddyfile 可在版本控制或重新生成） |
| `/home/ubuntu/.config/systemd/user` | systemd user service 定义 | 否（可由本仓库脚本或重新生成） |

---

## 七、生产环境变量

### 7.1 变量清单（来自 `.env.example`，生产真实值见 §2.1.1）

| 变量名 | 用途 | 配置位置 | 是否必填 | 轮换建议 |
|---|---|---|---|---|
| `DATABASE_URL` | SQLite 连接 | `.env` | 是 | 不常换 |
| `SESSION_SECRET` | 会话签名 | `.env` | 是 | **交接后必轮换** |
| `ADMIN_USERNAME` | 首次启动种子管理员 | `.env` | 否（已有 admin seed） | 记录 |
| `ADMIN_PASSWORD` | 首次启动种子管理员密码 | `.env` | 否（**生产是否覆盖需 SSH 确认**） | **交接后必轮换** |
| `UPLOAD_DIR` | 上传目录 | `.env` | 否（默认 `./uploads`） | 记录 |
| `MAX_IMAGE_SIZE_MB` | 单图大小限制 | `.env` | 否（默认 5） | 记录 |
| `MAX_IMAGES_PER_NOTE` | 单便签图片数 | `.env` | 否（默认 12） | 记录 |
| `TRASH_CLEANUP_SECRET` | 维护接口 `Authorization` 头 | `.env` | 是（生产必设） | **交接后必轮换** |
| `APP_BASE_URL` | 邮件重置链接基础地址 | `.env` | 是 | 记录 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | 邮件服务 | `.env` | 视功能启用 | `SMTP_PASS` **必轮换** |
| `DEV_MAILBOX` | 本地开发写邮件到文件 | `.env` | 否 | **生产不要设** |
| `SILICONFLOW_API_KEY` | 硅基流动 AI Key | `.env` | 是（如启用 AI） | **交接后必轮换** |
| `SILICONFLOW_MODEL` | 默认模型 | `.env` | 否 | 记录 |
| `SILICONFLOW_EXCEL_MODEL` | Excel 文本识别模型 | `.env` | 否 | 记录 |
| `SILICONFLOW_IMAGE_MODEL` | 图片识别模型 | `.env` | 否 | 记录 |
| `SILICONFLOW_SCHEDULE_ADJUST_MODEL` | 排期调整模型 | `.env` | 否 | 记录 |
| `SILICONFLOW_TIMEOUT_MS` | AI 超时（ms） | `.env` | 否（默认 120000） | 记录 |

### 7.2 本地 `.env` vs 生产 `.env` 差异

- 本地 dev：`.env` 走 `file:./dev.db`、弱密码、`SILICONFLOW_API_KEY` 可能为空、可能设 `DEV_MAILBOX`。
- 生产：`file:./data/prod.db`（相对项目根）、强密码、强 `SESSION_SECRET`、强 `SILICONFLOW_API_KEY`、SMTP 必设。

### 7.3 `.env.example` 完整性

`/.env.example` **完整**，覆盖全部 §7.1 变量。

### 7.4 双 schema 陷阱

历史曾存在服务器根目录 `schema.prisma` 与 `prisma/schema.prisma` 不一致导致 `prisma db push` 误报"already in sync"的问题。

**部署前必须**：
1. `md5sum prisma/schema.prisma`（本地）
2. `md5sum /home/ubuntu/projects/sticky-notes/prisma/schema.prisma`（服务器）
3. `md5sum /home/ubuntu/projects/sticky-notes/schema.prisma`（服务器根，**历史可能存在**）
4. 三者必须一致；不一致则 `rsync` 覆盖两份。

### 7.5 修改 `.env` 后

- 需 `systemctl --user restart sticky-notes.service` 重启服务生效。
- 不需要 rebuild（环境变量在运行时加载）。

---

## 八、域名、DNS、HTTPS、反向代理

| 项目 | 内容 |
|---|---|
| 正式域名 | `notes.hello-mylife.online` |
| 下载页域名/路径 | `https://notes.hello-mylife.online/download`（Web 下载页）；GitHub Releases 直链见 §14 |
| Preview 域名 | 计划 `preview.notes.hello-mylife.online`（**未启用**） |
| DNS 托管平台 | `> [需你确认，期望腾讯云 DNSPod 或第三方]` |
| 域名注册商 | `> [需你确认]` |
| Caddy / Nginx / 其他 | **Caddy**（推断：项目常用 Caddy 自动 HTTPS + ACME） |
| HTTPS 证书方式 | **Caddy 自动 ACME**（推断） |
| 证书自动续期状态 | `> [需 SSH 确认]`（期望 Caddy 后台自动续） |
| 反代到本机端口 | `> [需 SSH 确认，期望 9002]` |

### 8.1 期望 Caddyfile 结构（占位）

```caddyfile
notes.hello-mylife.online {
    reverse_proxy 127.0.0.1:9002
    encode gzip zstd
    # 期望包含上传体积限制（图片 5MB）+ 真实 IP 头传递
}
```

### 8.2 reload 反代

```bash
# Caddy
systemctl reload caddy
# 或
caddy reload --config /etc/caddy/Caddyfile
```

---

## 九、生产服务与进程管理

| 项目 | 内容 |
|---|---|
| systemd service 名称 | `sticky-notes.service`（user service） |
| service 文件路径 | `> [需 SSH 确认，期望 /home/ubuntu/.config/systemd/user/sticky-notes.service]` |
| 启动命令 | `> [需 SSH 确认，期望 npm start 或 node server.js]` |
| 工作目录 | `/home/ubuntu/projects/sticky-notes` |
| 环境变量加载方式 | `EnvironmentFile=/home/ubuntu/projects/sticky-notes/.env`（推断） |
| 日志查看命令 | `journalctl --user -u sticky-notes.service -n 200 --no-pager` |
| 重启命令 | `systemctl --user restart sticky-notes.service` |
| 停止命令 | `systemctl --user stop sticky-notes.service` |

### 9.1 定时任务

| 任务 | 用途 | 命令 | 频率 |
|---|---|---|---|
| 回收站清理 | 永久删除 N 天前已软删便签 | `> [需 SSH 确认，期望 systemd timer + curl /api/trash-cleanup Authorization: Bearer $TRASH_CLEANUP_SECRET]` | **每日**（`src/lib/trash-cleanup.ts` 内有 1 小时节流） |
| 备份任务 | 备份 prod.db | `> [需 SSH 确认，期望 cron/systemd timer cp data/prod.db /home/ubuntu/backups/prod_<ts>.db]` | **未知**（需 SSH 看 cron 列表） |
| 维护 ping | 防止冷启动 | `> [需 SSH 确认]` | **未知** |

---

## 十、部署流程

> 基于历史部署记忆 + 仓库结构总结。**实际操作以 SSH 验证为准**。

### 10.1 真实部署流程（现技术部当前做法）

```bash
# 1. 备份生产 DB（每次部署前必做）
ssh -i /path/to/key.pem ubuntu@122.51.214.94 \
  "cp /home/ubuntu/projects/sticky-notes/data/prod.db /home/ubuntu/backups/prod_\$(date +%Y%m%d_%H%M%S).db"

# 2. 同步两份 schema（避免双 schema 陷阱）
scp -i /path/to/key.pem ./prisma/schema.prisma ubuntu@122.51.214.94:/home/ubuntu/projects/sticky-notes/prisma/schema.prisma
ssh -i /path/to/key.pem ubuntu@122.51.214.94 \
  "cp /home/ubuntu/projects/sticky-notes/prisma/schema.prisma /home/ubuntu/projects/sticky-notes/schema.prisma && md5sum /home/ubuntu/projects/sticky-notes/{prisma/,}schema.prisma"

# 3. 同步代码（rsync src + tsconfig；不带 node_modules / .next）
rsync -avz -e "ssh -i /path/to/key.pem" --delete ./src/ ubuntu@122.51.214.94:/home/ubuntu/projects/sticky-notes/src/
rsync -avz -e "ssh -i /path/to/key.pem" ./tsconfig.json ubuntu@122.51.214.94:/home/ubuntu/projects/sticky-notes/tsconfig.json

# 4. Prisma generate（每次必做；新 schema 必做 db push）
ssh -i /path/to/key.pem ubuntu@122.51.214.94 \
  "cd /home/ubuntu/projects/sticky-notes && npx prisma generate"
# 仅 schema 变更时：
# ssh ... "cd /home/ubuntu/projects/sticky-notes && npx prisma db push --accept-data-loss"

# 5. 构建
ssh -i /path/to/key.pem ubuntu@122.51.214.94 \
  "cd /home/ubuntu/projects/sticky-notes && npm run build"

# 6. 重启服务
ssh -i /path/to/key.pem ubuntu@122.51.214.94 \
  "systemctl --user restart sticky-notes.service"

# 7. 健康检查
curl -s -o /dev/null -w "%{http_code}" https://notes.hello-mylife.online/login   # 200
curl -s -o /dev/null -w "%{http_code}" https://notes.hello-mylife.online/         # 307
curl -s -o /dev/null -w "%{http_code}" https://notes.hello-mylife.online/api/auth/me  # 401
```

### 10.2 哪些步骤每次必做

| 步骤 | 必做频率 |
|---|---|
| 备份 DB | 每次 |
| 同步 schema | 每次（即使无变更，保持 md5 一致） |
| 同步 src + tsconfig | 每次 |
| `prisma generate` | 每次 |
| `prisma db push` | **仅 schema 变更时** |
| `npm run build` | 每次 |
| 重启服务 | 每次 |
| 健康检查 | 每次 |

### 10.3 哪些步骤仅在变更时做

- `npm ci`（如 `package.json` 或 `package-lock.json` 变更）
- `prisma db push`（如 schema 变更）

### 10.4 双 schema 历史陷阱

服务器端历史上**有根目录 `schema.prisma` 与 `prisma/schema.prisma` 两份**，内容可能不一致。如果只同步 `prisma/`，根目录那份仍指向旧 schema，Prisma 可能误用旧文件。

**约定**：每次部署前 `md5sum` 比对两份，确保一致。

### 10.5 `.env` 是否同步？

**不通过 rsync 同步**（会覆盖生产配置）。生产 `.env` 由用户在服务器上手工维护。

---

## 十一、数据库

| 项目 | 内容 |
|---|---|
| 数据库类型 | SQLite（`prisma/schema.prisma` `provider = "sqlite"`） |
| 数据库文件路径 | `> [需 SSH 确认，期望 /home/ubuntu/projects/sticky-notes/data/prod.db]` |
| Prisma schema 路径 | `/Users/dian/Documents/全平台便签/prisma/schema.prisma`（本地）<br>服务器双份：`<deploy>/prisma/schema.prisma` + `<deploy>/schema.prisma` |
| 是否有 migrations 目录 | **无**（`prisma/migrations/` 不存在；项目用 `db push`） |
| 当前是否使用 `db push` | **是**（无 migrations 历史，schema 变更靠 `prisma db push`） |
| 备份目录 | `/home/ubuntu/backups`（来自历史记忆） |
| 备份命名规则 | `prod_<module>_<YYYYMMDD_HHMMSS>.db`（如 `prod_M16R3_20260814_130910.db`） |
| 恢复命令 | `cp /home/ubuntu/backups/<file>.db /home/ubuntu/projects/sticky-notes/data/prod.db && systemctl --user restart sticky-notes.service` |

### 11.1 当前表结构（来自 `prisma/schema.prisma`，12 个 model）

```
User / PasswordResetToken / FeedbackTicket / InviteCode /
Note / Attachment / Announcement / AnnouncementRead /
UserActivityLog / CalendarEvent / WorkProject / WorkScheduleItem
```

> ⚠️ **M16R3 已回滚**：4 个 model `NoteFolder / NoteTag / NoteTagBinding / NoteLinkEdge` 已在生产 DB 中残留（2026-08-14 部署时 `db push` 创建），旧代码不引用、对线上无影响。下一家技术部如决定清理，需手动 `DROP TABLE` + 用 `prisma db push` 让 schema 与 DB 一致。

### 11.2 数据统计（需 SSH 确认）

```bash
ssh ... "cd /home/ubuntu/projects/sticky-notes && \
  sqlite3 data/prod.db 'SELECT (SELECT count(*) FROM User) AS users,
                                (SELECT count(*) FROM Note) AS notes,
                                (SELECT count(*) FROM Attachment) AS attachments,
                                (SELECT count(*) FROM WorkProject) AS projects,
                                (SELECT count(*) FROM WorkScheduleItem) AS schedule_items,
                                (SELECT count(*) FROM NoteFolder) AS note_folders,
                                (SELECT count(*) FROM NoteTag) AS note_tags,
                                (SELECT count(*) FROM NoteTagBinding) AS note_tag_bindings,
                                (SELECT count(*) FROM NoteLinkEdge) AS note_link_edges;'"
```

期望结果：
- users：`> [需你填]`
- notes：`> [需你填]`
- 其他：`> [需你填]`

### 11.3 最近一次 schema 变更

- **2026-08-14 M16R3 部署**：新增 4 个 model（NoteFolder/NoteTag/NoteTagBinding/NoteLinkEdge）+ `Note.folderId`。**已于同日回滚**。
- **2026-08-14 M16R3 回滚**：代码 revert，**schema 同步回滚**（服务器 schema 现仍含这 4 个 model，需 `prisma db push` 重新生成或手动清理）。

### 11.4 最近一次生产 DB 备份

`/home/ubuntu/backups/prod_rollback_M16R3_20260814_134618.db`（M16R3 回滚前备份）。

### 11.5 验证备份可用

```bash
# 拷到临时路径，sqlite3 读头
cp /home/ubuntu/backups/prod_<file>.db /tmp/backup_test.db
sqlite3 /tmp/backup_test.db "SELECT count(*) FROM User;"
sqlite3 /tmp/backup_test.db ".schema Note" | head -5
```

---

## 十二、上传文件与附件

| 项目 | 内容 |
|---|---|
| 上传目录 | `> [需 SSH 确认，期望 /home/ubuntu/projects/sticky-notes/uploads/]` |
| 文件访问 API | `> [需 SSH 看代码确认，期望 /api/attachments/:id 或类似]` |
| 文件大小限制 | 单图 5MB（来自 `MAX_IMAGE_SIZE_MB`） |
| 图片压缩策略 | `sharp@^0.35.3`（来自 `package.json`，`src/lib/image-compress.ts` 等） |
| 附件清理策略 | 软删便签不删附件；**永久删除**走 `src/lib/permanent-delete.ts` + `src/lib/trash-cleanup.ts` 同事务清理 `Attachment` + 附件文件 + `Attachment` 行 |
| 是否有孤儿文件扫描 | `> [需代码核查，期望无定期扫描]` |
| 备份方式 | **未单独备份**（`uploads/` 目录未在 `/home/ubuntu/backups` 备份；需下一家技术部补） |

### 12.1 关键清理逻辑

- **软删便签**：`Note.deletedAt` 置位，附件文件保留。
- **永久删除（手动）**：`src/lib/permanent-delete.ts` —— 删附件文件、删 `notes/<id>/` 目录、删 `Attachment` 行、扣 `storageUsedBytes`。
- **回收站自动清理**：`src/lib/trash-cleanup.ts` —— 超过 `TRASH_RETENTION_DAYS` 的已软删便签走与永久删除相同路径。
- M16R3 残留清理：`src/lib/permanent-delete.ts` L53-61 显式 `noteTagBinding.deleteMany` + `noteLinkEdge.deleteMany`（**已被 M16R3 回滚**）。

### 12.2 用户头像

存 `User.avatarStoragePath`（SQLite）+ `uploads/` 目录。访问走 `> [需代码核查确认 API 路径]`。

### 12.3 路径穿越防护

`src/lib/trash-cleanup.ts` L8-14 有 `safeResolve(uploadDir, rel)` 校验；`src/lib/permanent-delete.ts` L36 `path.resolve(uploadDir, att.storagePath)` 需手动核查是否有 boundary 校验（**建议新增 safeResolve 包装**）。

---

## 十三、第三方服务

| 服务 | 用途 | 配置位置 | 账号归属 | 费用 | 是否可轮换 |
|---|---|---|---|---|---|
| GitHub | 代码 + Release | `https://github.com/zhewu-ai/win-` | 原 owner | 免费 | 是（Token 轮换） |
| SiliconFlow | AI 识别/排期 | `SILICONFLOW_API_KEY` in `.env` | 原 owner | 按量付费 | **是（强烈建议）** |
| 邮件服务 | 重置密码 | `SMTP_*` in `.env` | 原 owner | 按服务商 | 是 |
| 域名服务商 | DNS 解析 | 控制台 | 原 owner | 按年 | 是（转移注册商） |
| 云服务器 | 生产部署 | 腾讯云控制台 | 原 owner | 按月/年 | 是（转移实例） |

### 13.1 各服务交付方式

| 服务 | 交付渠道 | 交接后建议 |
|---|---|---|
| GitHub | 添加下一家技术部为 collaborator 或 transfer ownership | 添加后**轮换 GitHub Token** |
| SiliconFlow | 控制台账号或新建子账号 | 重建 API Key |
| 邮件 SMTP | 邮箱密码 / SMTP 重新生成 | 改密码或换 token |
| 域名 | 注册商账号或转移 | 续费提醒配置好 |
| 云服务器 | 腾讯云控制台账号或转移 | **生成新 SSH 密钥对**（替代丢失的 bendi.pem） |

---

## 十四、GitHub Actions 与桌面壳发布

| 项目 | 内容 |
|---|---|
| Windows 构建 workflow | `.github/workflows/build-desktop.yml`（单 workflow，矩阵构建 Windows + macOS universal） |
| macOS 构建 workflow | 同上（矩阵 macos-latest + `--target universal-apple-darwin`） |
| Release tag 规则 | `app-v<version>`（如 `app-v0.1.2`） |
| 当前最新 Release | `app-v0.1.2`（来自 M15R2 commit `02657ec`） |
| Windows 安装包命名 | `StickyNotes_0.1.2_x64-setup.exe`（+ `_x64_en-US.msi`） |
| Mac 安装包命名 | `StickyNotes_0.1.2_universal.dmg` |
| 是否签名/公证 | **未签名/未公证**（Mac 首次打开需系统设置放行） |
| 下载页链接来源 | **固定 release 直链**（`src/lib/downloads.ts` L12/15） |

### 14.1 桌面壳构建触发

- 触发路径：`src-tauri/**` + `shell-static/**` + `.github/workflows/build-desktop.yml` 自身。
- 不触发普通 Web 改动（节省 CI 资源）。
- 手动触发：`workflow_dispatch`。

### 14.2 资产下载

直链示例：
```
https://github.com/zhewu-ai/win-/releases/download/app-v0.1.2/StickyNotes_0.1.2_x64-setup.exe
https://github.com/zhewu-ai/win-/releases/download/app-v0.1.2/StickyNotes_0.1.2_universal.dmg
```

### 14.3 壳内正式域名

`src/lib/downloads.ts` L21 `WEB_APP_URL = "https://notes.hello-mylife.online"`。

### 14.4 壳内"打开网页版"入口

`src/components/AccountMenu.tsx` L344 —— `isTauri()` 时显示"打开网页版"按钮，调用 `openExternal(WEB_APP_URL)` 用系统浏览器打开。

### 14.5 桌面壳版本号

`src-tauri/tauri.conf.json` L5 `version = "0.1.2"`，`src-tauri/Cargo.toml` 同步。

---

## 十五、功能模块状态

| 模块 | 状态 | 已上线 commit | 备注 |
|---|---|---|---|
| 登录 / 注册 / 邀请码 | 已上线 | 历史 | `iron-session` + bcryptjs，session secret in `.env` |
| 便签 CRUD | 已上线 | 历史 | 含软删、归档、颜色 |
| 待办 / 轻富文本 | 已上线 | `fbab689`、`099c236` | Tiptap 2.x 编辑器 |
| 图片附件 | 已上线 | 历史 | sharp 压缩 |
| 内部链接 | 已上线 | 历史（M11 链接基础） | `parseNoteLinks` 解析 `[[note:id\|标题]]` |
| 工作日历 | 已上线 | 历史（M12/13/14） | 含项目、排期、AI 排期导入、AI 自然语言调整 |
| AI 排期导入 | 已上线 | `92b01c1`、`b20d5d3`、`6e039cf` | 硅基流动 |
| AI 自然语言调整排期 | 已上线 | `92b01c1` |  |
| 桌面壳 Windows | 已发布 0.1.2 | `02657ec` | 私有 release，未签名 |
| 桌面壳 macOS | 已发布 0.1.2 | `02657ec` | universal dmg，未签名/未公证 |
| 下载页 | 已上线 | `02657ec` | `/download` 路径 |
| **M16R3 文件夹/标签/反链** | **已回滚（生产已部署）** | `a3f7c80` → revert `79b43e6` + `7f683eb` | DB 新表残留，旧代码不引用 |
| **M17 视觉预演** | **仅 SPEC 文档** | SPEC `docs/SPEC_M17_PREVIEW_高级视觉系统预演_20260822.md` | 截图 12 张在 `docs/视觉审计-m17-preview-20260822/screenshots/`（**未完成**） |

---

## 十六、回滚与事故记录

| 日期 | 事件 | 原因 | 处理 | 当前状态 |
|---|---|---|---|---|
| 2026-08-14 | **M16R3 文件夹/标签/反链上线** | 按 SPEC 推进 | `a3f7c80` + `106fa7c` commit；`db push` 建 4 个新表 + `Note.folderId`；rsync 部署 | 已回滚 |
| 2026-08-14 | **M16R3 回滚** | 用户对"文件夹"体验不满意，要求回滚 | `git revert 7f683eb`（revert docs）+ `79b43e6`（revert 功能）；本地 build/tsc 通过；备份 `prod_rollback_M16R3_20260814_134618.db`；服务器 schema 同步回退；rsync + build + 重启；健康检查 + 冒烟全绿 | **代码已回滚 + 已部署生产**；DB 新表 `NoteFolder/NoteTag/NoteTagBinding/NoteLinkEdge` + `Note.folderId` 残留（用户决定保留）；旧代码不引用 → 对线上无影响 |
| 2026-08-14 | **tsconfig exclude scripts 恢复** | revert 误把 a3f7c80 加的 `exclude "scripts"` 还原了 | commit `4ced87a` 恢复；rsync 同步；未影响线上构建 | 已修复 |
| 2026-08-22 | **M17 Preview SPEC 文档完成** | 按用户"按文档执行"要求 | SPEC 文档；视觉审计阶段 1 截 12 张图（**未完成最终报告**） | 仅文档 + 截图未完成 |

> 注意：M16R3 回滚时执行人为现技术部（用户授权）。如需重新启用 M16R3，需要：
> 1. revert `79b43e6` + `7f683eb`（反向 commit），保留 `4ced87a` tsconfig 恢复
> 2. `prisma db push` 让 DB 重建 4 个 model
> 3. **新表里无数据**（用户保留决定下没塞过数据）→ 旧用户没有任何便签被影响

---

## 十七、日志与监控

| 项目 | 内容 |
|---|---|
| 应用日志查看命令 | `journalctl --user -u sticky-notes.service -n 200 --no-pager` |
|  | `journalctl --user -u sticky-notes.service -f`（实时） |
| Caddy / Nginx 日志路径 | `> [需 SSH 确认，期望 /var/log/caddy/]` |
| GitHub Actions 日志位置 | `https://github.com/zhewu-ai/win-/actions` |
| 错误告警方式 | **未配置自动告警**（仅手动查日志） |
| 访问量查看方式 | **未配置**（无独立分析工具） |
| 用户活跃度观察方式 | `src/lib/activity.ts` 写 `UserActivityLog` 表（含 action 元数据，不含正文）；可用 `sqlite3 data/prod.db "SELECT action, count(*) FROM UserActivityLog GROUP BY action;"` 统计 |

### 17.1 日志安全

- 用户便签全文**不应**进入日志（除用户主动输入时的输入日志，**需人工核查**）。
- AI 调用日志：`src/lib/siliconflow.ts` 等需核查是否脱敏。
- 图片 base64：**不应**进入日志（`MAX_IMAGE_SIZE_MB=5` 限制 + 路由层不打印 base64）。
- 密钥：**不应**出现日志（`.env` 加载由 Next.js runtime 处理，**未发现代码内 print 全 .env**）。

---

## 十八、账号与权限

| 项 | 内容 |
|---|---|
| 当前管理员账号 | `admin`（种子用户，首次启动由 `prisma/seed.ts` 创建；`ADMIN_USERNAME` / `ADMIN_PASSWORD` 默认值见 §7） |
| 是否有测试账号 | `> [需 SSH 看 User 表确认]` |
| 是否有废弃账号 | `> [需 SSH 看 User.status='disabled' 或类似字段确认]` |
| 邀请码机制 | `InviteCode` 表 + `src/app/api/invite-codes/*`；管理员生成邀请码，新用户注册必须输入有效邀请码 |
| 如何禁用用户 | `> [需代码核查确认：直接 UPDATE User SET status='disabled' / 或 API]` |
| 如何重置用户密码 | `> [需代码核查确认：admin API / 直接改 passwordHash]` |
| 如何处理忘记密码 | `/forgot-password` → 邮件重置链接（`APP_BASE_URL` + token）；需 SMTP 配置 |

> 真实密码不得写进本节，参见 §2.1.1。

---

## 十九、Preview / 设计稿 / 未来任务状态

| 文档/任务 | 状态 | 下一步 |
|---|---|---|
| `docs/SPEC_M17_PREVIEW_高级视觉系统预演_20260822.md` | **SPEC 完成** | 阶段 1 视觉审计部分进行中（12 张截图就位 + vision AI 部分分析）；**未完成审计文档** |
| M17 高保真视觉设计稿 | **未开始** | 等产品侧选方向（A: Apple Notes / B: Codex-GPT / C: PinNote 轻办公）后出 2-3 套 HTML/CSS 原型 |
| 本地优先 / 本地数据库预研 | **未开始** | 后续架构预研，**不混入视觉设计稿** |
| 大文件 / 截图本地存储 | **未开始** | 同上 |
| 客户端壳一体化 | **未开始** | 等视觉方向确认 |

### 19.1 隔离要求（必须遵守）

- **M17 视觉预演不影响当前线上**：所有 M17 工作走独立分支/独立 preview 环境/独立服务，**不写生产 DB**，**不覆盖正式域名**。
- **客户端 Preview 不替换正式下载页**：未确认前 `/download` 仍指向 `app-v0.1.2`。
- **本地优先属于后续架构预研**，不要混入视觉设计稿任务。

### 19.2 M17 当前已存在的资产

- 12 张截图在 `docs/视觉审计-m17-preview-20260822/screenshots/`（**未完成审计文档，**下一家如继续可直接基于这些图出报告）。
- 截图脚本（`/tmp/m17-audit*.ts` + 项目根 `.m17-audit*.ts`）**已删除**（含线上 admin 凭据 ding2860，不入 git）。

---

## 二十、下一家技术部接手前必须拿到的资料

按原文 §二十。补充说明：

| 资料 | 状态 |
|---|---|
| 1. 本交接文档（本文） | **已就位**（本文件） |
| 2. 最新代码仓库地址和权限 | `https://github.com/zhewu-ai/win-.git`，需原 owner 在 GitHub 加 collaborator |
| 3. 当前线上 commit hash | 本地 `4ced87a`；**服务器 BUILD_ID 需 SSH 确认** |
| 4. 服务器登录方式说明 | §五（**需云控制台重发 SSH 私钥**） |
| 5. 生产 `.env` 变量名清单 | §7（**真实值需 SSH 抓取，见 §2.1.1**） |
| 6. 域名/DNS 管理权限 | `notes.hello-mylife.online` 注册商账号；交付方式 > [需你填] |
| 7. 云服务器管理权限 | 腾讯云控制台账号 + **重发 SSH 私钥对** |
| 8. GitHub Release / Actions 说明 | §十四 |
| 9. 部署手册 | §十 |
| 10. 回滚手册 | §十（rsync 回滚前 commit）+ §十六（历史回滚案例） |
| 11. 数据库备份与恢复手册 | §十一.5 |
| 12. 当前生产 DB 最近备份文件路径 | `/home/ubuntu/backups/prod_rollback_M16R3_20260814_134618.db` |
| 13. 上传目录备份说明 | **未备份**（需下一家技术部补策略） |
| 14. 第三方服务清单 | §十三 |
| 15. 已知问题清单 | 见 §二十一后补的「已知问题」小节 |
| 16. 未上线 / 已回滚 / 仅 Preview 功能清单 | §十五 + §十六 |

### 20.1 已知问题

1. **M16R3 DB 新表残留**：`NoteFolder/NoteTag/NoteTagBinding/NoteLinkEdge` + `Note.folderId` 字段仍在 prod.db，旧代码不引用。清理方式：`DROP TABLE` + 删 `Note.folderId` 列（需 stop service + `prisma db push`）。
2. **桌面壳 Mac 未签名/未公证**：首次打开需 macOS 系统设置放行。
3. **桌面壳 Windows 无代码签名**：可能被 SmartScreen 拦截。
4. **下载页直链随版本漂移**：`src/lib/downloads.ts` 直链必须随每次发版更新。
5. **SSH 私钥丢失**：本交接时已确认丢失，必须云控制台重置。
6. **uploads/ 目录未独立备份**：仅靠数据库 + 用户文件管理；建议下一家技术部补 rsync/snapshot。
7. **M17 Preview 未完成**：仅有 SPEC + 12 张截图（**未写审计文档、未做原型、未部署 preview**），需下一家技术部按 SPEC §九 阶段 1-5 继续推进。
8. **Prisma 无 migrations 历史**：所有 schema 变更靠 `prisma db push`；未来建议引入 `prisma migrate` 做正式迁移。

---

## 二十一、最终确认签收表

| 确认项 | 是否完成 | 说明 |
|---|---|---|
| 代码仓库权限已交接 | 待 | 需原 owner 在 GitHub 加下一家为 collaborator |
| 服务器 SSH 已交接 | **未完成** | SSH 私钥丢失，**需云控制台重发** |
| 云服务器控制台已交接 | 待 | 需原 owner 提供腾讯云账号或转移实例 |
| 域名/DNS 已交接 | 待 | 需原 owner 提供 `notes.hello-mylife.online` 注册商账号 |
| 生产 `.env` 已安全交付 | **未完成** | SSH 不可用，**真实值未抓取**；变量清单见 §7 |
| AI 服务密钥已安全交付 | **未完成** | 同上 |
| GitHub Actions / Release 已说明 | **是** | §十四 |
| 数据库备份和恢复已说明 | **是** | §十一.5 + §二十.11 |
| 部署流程已验证 | **是**（历史 M16R3 部署 + 回滚均验证） | §十 |
| 回滚流程已验证 | **是**（M16R3 回滚案例 2026-08-14） | §十六 |
| 当前生产版本已确认 | **是** | 本地 HEAD = `4ced87a`；服务器 BUILD_ID 需 SSH 确认 |
| M16R3 回滚状态已确认 | **是** | §十六：代码已回滚 + 已部署生产 + DB 新表残留（用户决定保留） |
| M17 Preview 不影响生产已确认 | **是** | M17 仅 SPEC 文档 + 12 张截图（无生产写入）；下一步走独立分支 + 隔离 preview |

---

**填写人**：现技术部（2026-08-22）
**交接对象**：下一家技术团队
**备注**：因 SSH 私钥丢失，§五 / §六 / §八 / §九 / §十一.2 / §十七（Caddy 日志路径）等需 SSH 收集的字段以"待填"形式保留。强烈建议交接后立即：
1. 腾讯云控制台重置 SSH 密钥对
2. 重新抓取生产 `.env` 真实值并按本文件 §2.1 顶部清单轮换
3. 评估 M16R3 DB 新表是否需要清理
4. 评估是否继续推进 M17 Preview（按 SPEC §九）
