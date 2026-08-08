# Next.js 升级评估交付报告（15.5.23 vs 16.3.0）

日期：2026-08-08
分支：`codex/next-upgrade-preview`
关联：`docs/SPEC_NEXT_UPGRADE_PREVIEW_BRANCH_20260808.md`

---

## 一、结论摘要

- 生产 Next.js 14.2.35（已 EOL，缺 2026-07 安全修复）已完成独立分支适配；15.5.23 preview 全量验收通过后，按用户决定继续 16.3.0 对比。
- **16.3.0 定版**：`npm audit --omit=dev` **0 漏洞**（15.5.23 的 2 个构建期 postcss 漏洞在 16.3.0 消除）；`tsc --noEmit` 与 `next build` **零额外代码改动**通过；16.3.0 preview 已部署并**全量验收通过**（API 32/32 + SSR 全页面 + PWA）。React 18.3.0 仍被支持（peer `^18.2.0 || ^19.0.0`），服务器 Node v22.22.3 满足 engines（>=20.9）。
- **关键教训**：本服务器上 `next build` 默认的 **Turbopack 会吃满内存导致整机 thrash**（preview+prod 同机，一度同时宕机）；改用 **`next build --webpack`** 后构建 1 分钟内完成、内存平稳。生产构建必须走 webpack。
- **合并决定**：用户选定「直接 16.3.0 再合并」，本轮验收全绿，**推荐并执行合并**（见第八节）。

---

## 二、分支与提交

- `codex/next-upgrade-preview`：15.5.23 适配分支（生产 main/服务/数据库未动），提交：
  - `5e7145b` docs: Next 升级评估方案——独立分支 + 独立 preview 环境
  - `de940b1` chore: upgrade next dependency for preview evaluation（next ^15.5.23、postcss ^8.5.23、overrides nanoid/sharp）
  - `2f3b41b` fix: adapt next async request APIs（17 个路由 + 3 个页面 + auth.ts）
  - `ee9b636` docs: Next 升级评估交付报告（15.5.23 验收通过 + 16.3.0 对比归零）
- `codex/next-upgrade-16`：16.3.0 定版分支，基于上述分支追加：
  - `80551d8` chore(next16): next 15.5.23 → 16.3.0，audit 归零，tsc/build 零代码改动通过（含 tsconfig/next-env 由 next 16 自动更新）

共 26 文件改动，+589 / -193。main 与 16 分支为干净 fast-forward，无缺失提交。

---

## 三、Preview 环境

- **URL**：https://preview.hello-mylife.online（生产 Let's Encrypt 证书，issuer YE2）
- **数据源**：独立 `preview.db`（种子 + 验收测试数据），**非生产库副本**；与生产完全隔离
- **隔离性**：独立端口 9012（安全组不对外暴露）、独立 systemd user service `sticky-notes-preview`、独立 Caddy 站点、独立 uploads 目录、独立 `.env`
- **账号**：admin / `preview2026`（admin role 已手动提升）；测试用户 `acc.user1@example.com` / `ChangedPass789`
- **DEV_MAILBOX**：启用，验证 forgot-password → 邮箱 token → reset 全链路

---

## 四、版本对比

| 维度 | next 15.5.23（当前分支） | next 16.3.0 |
|---|---|---|
| `npm audit --omit=dev` | **2 漏洞**（1 high + 1 moderate，next 内嵌 postcss@8.4.31，仅构建期，运行时不可利用） | **0 漏洞** |
| `tsc --noEmit` | 通过 | **通过（零额外代码改动）** |
| `next build` | 通过（preview 实际运行） | **通过（34 路由全部编译）；本机必须 `--webpack`（Turbopack 内存超限，见已知问题）** |
| React | 18.3.0 | 18.3.0（peer 支持 `^18.2.0`） |
| Node | >=18 | >=20.9（服务器 v22.22.3 ✓） |
| sharp | 靠 override `^0.35.3` | next 直接携带 `^0.35.3`（override 不再必需，保留无害） |
| postcss | 直接依赖 8.5.23 + next 内嵌 8.4.31（漏洞源） | next 直接携带 **8.5.23（已修复）** |
| 升级跳距 | 14 → 15（中） | 14 → 16（大；async API 适配已覆盖主要破坏点） |

postcss 漏洞说明：advisory 针对 CSS 序列化/源映射处理，攻击面要求把**攻击者可控的 CSS** 喂给 postcss。本项目只处理自身静态 CSS，不接收用户 CSS，运行时不可达；但 audit 保持红色。

---

## 五、改动清单（分支相对 main）

- `package.json`：`next ^14.2.0 → ^16.3.0`（16 定版，先经 15.5.23 过渡）；`postcss ^8.4.0 → ^8.5.23`；保留 `overrides { nanoid ^3.3.17, sharp ^0.35.3 }`（16 已直接携带修复版本，保留无害）
- `src/lib/auth.ts`：`getIronSession(await cookies(), ...)`（唯一 next/headers 调用）
- 17 个 API 路由：`params` 改为 `Promise<{...}>` + handler 内 `await params`（含 files/[...path] 的 `path` 变量规避、多参解构、双 handler 文件）
- 3 个页面：`login/page.tsx`、`reset-password/page.tsx`（`searchParams` Promise）、`notes/[id]/floating/page.tsx`（`params` Promise）
- `package-lock.json`、`next-env.d.ts`、`docs/`（SPEC + INDEX）

---

## 六、验收结果（16.3.0 preview 复验全绿）

### API 层（32/32 通过）

- 认证：admin 登录；登录频控（5 次 401 后第 6 次 429）；邀请码注册 + 示例便签生成；忘记密码 → DEV_MAILBOX token → 重置 → 新密码登录；改密；禁用账号旧 session 被拒（403 ACCOUNT_DISABLED）
- 便签：新建 / 编辑 / 切色 / 置顶 / 归档 / 取消归档 / 搜索 / 删除到回收站 / 恢复 / 永久删除
- 待办：勾选状态更新；超过 500 条被拒（400）
- 附件：真实 PNG 上传成功；伪装 SVG 被拒（400）；超大图被拒（413）；删除后存储额度回落
- 公告：发布、用户阅读、列表/阅读统计接口
- 后台权限：未登录 admin API → 401；普通用户 → 403；管理员列表 → 200
- 活跃度：新用户 UserActivityLog 落记录、User.lastActiveAction 更新
- 说明：首轮跑完 7 个失败项经核实为脚本断言/复用已删 note 的 bug + 复用账号的频控状态，逐一修复脚本后复跑全绿；4 个受频控影响的项用全新账号/全新 IP 隔离复验均通过。

### 前端 / SSR 层

- 全部页面 200 且含预期内容：`/` `/archive` `/trash` `/admin/users` `/admin/announcements` `/admin/feedback` `/login` `/reset-password` `/notes/[id]/floating`
- `/login` 已登录访问 → 307 跳首页（正确）
- `/notes/[id]` 404（应用本无此路由，编辑器在主页面内，正确）；`/settings` 404（应用本无此路由，正确）
- 页面加载期间服务端 **0 条 error 日志**（无 SSR 异常、无未捕获错误）
- PWA：`/sw.js` 200（离线 App Shell 策略有效）、`/icon.png` 200（512KB）；无 manifest —— 与 prod（Next 14）行为一致，属既有状态非回归

### 未做项（需要浏览器人工确认）

交互式浏览器验收（三点菜单、对话框、主题切换、320px/390px 窄屏横向溢出、水合一致性）本次未能自动化执行 —— Chrome 扩展未连接且本机无 headless 浏览器。已用 SSR + 服务端日志佐证无白屏、无渲染错误。**建议用户直接访问 preview 完成最终目验**（admin / preview2026）。

---

## 七、已知问题

1. **Turbopack 构建内存超限导致整机宕机（本次事故，已恢复）**
   - 现象：升级 preview 到 16.3.0 时执行默认的 `next build`（Next 16 默认 Turbopack），在这台**同时运行 preview 与 prod 的共享 VM（3.7G 内存 + 1.9G swap）** 上持续 thrash 约 30 分钟，最终 SSH、Caddy、preview、prod 全部无响应；控制台强制重启后恢复。
   - 根因：Turbopack 构建峰值内存远超该机型可用内存（叠加运行时 next-server 占用），swap 磁盘 thrash 拖垮整机。
   - 解决：改用 `next build --webpack` —— 服务器上 1 分钟内完成、内存平稳。**生产构建必须带 `--webpack`。**
2. **`Server Reference ID did not match the expected format` 日志**（非阻塞，16.3.0 重启后 0 次）
   - 现象：15.5.23 preview 8/8 17:43-17:44 出现 7 次（6 次全零 payload + 1 次 `"y"`），prod（Next 14）近 7 天 0 次。
   - 判定：时间与 Caddy 证书签发/服务重启重叠，payload 为畸形探针请求；真实请求（登录 + 建便签）0 次。属**扫描探针噪声，非功能回归**。差异仅是 Next 对畸形 flight 请求打 error 日志而 Next 14 静默。
3. **audit**：16.3.0 归零，已无残留。
4. 交互式前端未自动化目验（见第六节未做项）。

---

## 八、合并决定（用户已选定 B，已执行）

用户选定 **B：直接做 16.3.0 再合并**。16.3.0 preview 已部署并全量验收通过（audit 0、tsc/build 零改动通过、API 32/32、SSR 全绿），**决定：合并 `codex/next-upgrade-16` 到 main 并上线**。

被否决方案：
- A（先合 15.5.23 再跟进）：被 16.3.0 零成本全绿的事实弱化，两步并一步更省。
- C（放弃）：14.2.35 已 EOL，缺 2026-07 安全修复（含 App Router 也涉及的 CVE-2026-23869/23870 RSC/flight DoS），不采纳。

## 九、生产上线步骤（16.3.0，已完成/执行中）

1. 备份生产 DB：`cp data/prod.db /home/ubuntu/backups/prod_next16_<ts>.db`。
2. 合并 `codex/next-upgrade-16` 到 main（fast-forward）并 push。
3. rsync `src/`（--delete）+ 显式同步根目录改动文件（package.json、package-lock.json、tsconfig.json、next-env.d.ts），保留生产 `.env` 与 uploads。**无 prisma schema 变更，无需 db push。**
4. `npm ci`。
5. **`rm -rf .next && npm run build -- --webpack`**（必须 webpack，见已知问题）。构建前先 `systemctl --user stop sticky-notes-preview` 释放内存，构建完再启动。
6. 重启生产 `sticky-notes.service`。
7. 健康检查：`/login` 200、未登录 `/` 307、`/api/auth/me` 401、登录 200、`journalctl` 无 error。
8. 观察 24h：便签 CRUD、登录、附件上传、公告发布、后台。

## 十、生产回滚步骤

1. 保留上线前 main 快照（旧 commit / 旧构建产物）。
2. `git checkout` 回旧提交 → `npm ci` → `npm run build` → 重启 service。
3. 无 schema 变更、无数据迁移，DB 无需回滚；uploads 不受影响。
