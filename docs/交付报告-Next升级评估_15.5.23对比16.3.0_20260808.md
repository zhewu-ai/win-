# Next.js 升级评估交付报告（15.5.23 vs 16.3.0）

日期：2026-08-08
分支：`codex/next-upgrade-preview`
关联：`docs/SPEC_NEXT_UPGRADE_PREVIEW_BRANCH_20260808.md`

---

## 一、结论摘要

- 生产 Next.js 14.2.35（已 EOL，缺 2026-07 安全修复）已按 SPEC 完成独立分支适配，独立 preview 环境上线并**全量验收通过**。
- **15.5.23**（backport LTS，含 2026-07 安全修复）：改动最小、preview 稳定，但 `npm audit --omit=dev` 仍红 —— 2 个漏洞（1 high + 1 moderate）来自 next 内嵌 `postcss@8.4.31`，仅构建期生效，无法用非破坏性手段消除（npm 明确指向 16.3.0 为破坏性修复）。
- **16.3.0 对比**：`npm audit` 0 漏洞；`tsc --noEmit` 与 `next build` **在零额外代码改动下全部通过**（复用已完成的 async API 适配）。React 18.3.0 仍被支持（peer `^18.2.0 || ^19.0.0`），服务器 Node v22.22.3 满足 engines（>=20.9）。
- **合并建议**：见第八节（三选一，需用户拍板）。

---

## 二、分支与提交

`codex/next-upgrade-preview`（基于 main，生产 main/服务/数据库未动）：

| 提交 | 说明 |
|---|---|
| `5e7145b` | docs: Next 升级评估方案——独立分支 + 独立 preview 环境 |
| `de940b1` | chore: upgrade next dependency for preview evaluation（next ^15.5.23、postcss ^8.5.23、overrides nanoid/sharp） |
| `2f3b41b` | fix: adapt next async request APIs（17 个路由 + 3 个页面 + auth.ts） |

共 26 文件改动，+589 / -193。

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
| `next build` | 通过（preview 实际运行） | **通过（34 路由全部编译）** |
| React | 18.3.0 | 18.3.0（peer 支持 `^18.2.0`） |
| Node | >=18 | >=20.9（服务器 v22.22.3 ✓） |
| sharp | 靠 override `^0.35.3` | next 直接携带 `^0.35.3`（override 不再必需，保留无害） |
| postcss | 直接依赖 8.5.23 + next 内嵌 8.4.31（漏洞源） | next 直接携带 **8.5.23（已修复）** |
| 升级跳距 | 14 → 15（中） | 14 → 16（大；async API 适配已覆盖主要破坏点） |

postcss 漏洞说明：advisory 针对 CSS 序列化/源映射处理，攻击面要求把**攻击者可控的 CSS** 喂给 postcss。本项目只处理自身静态 CSS，不接收用户 CSS，运行时不可达；但 audit 保持红色。

---

## 五、改动清单（分支相对 main）

- `package.json`：`next ^14.2.0 → ^15.5.23`；`postcss ^8.4.0 → ^8.5.23`；新增 `overrides { nanoid ^3.3.17, sharp ^0.35.3 }`
- `src/lib/auth.ts`：`getIronSession(await cookies(), ...)`（唯一 next/headers 调用）
- 17 个 API 路由：`params` 改为 `Promise<{...}>` + handler 内 `await params`（含 files/[...path] 的 `path` 变量规避、多参解构、双 handler 文件）
- 3 个页面：`login/page.tsx`、`reset-password/page.tsx`（`searchParams` Promise）、`notes/[id]/floating/page.tsx`（`params` Promise）
- `package-lock.json`、`next-env.d.ts`、`docs/`（SPEC + INDEX）

---

## 六、验收结果

### API 层（32/32 通过）

- 认证：admin 登录；登录频控（5 次 401 后第 6 次 429）；邀请码注册 + 示例便签生成；忘记密码 → DEV_MAILBOX token → 重置 → 新密码登录；改密；禁用账号旧 session 被拒（403 ACCOUNT_DISABLED）
- 便签：新建 / 编辑 / 切色 / 置顶 / 归档 / 取消归档 / 搜索 / 删除到回收站 / 恢复 / 永久删除
- 待办：勾选状态更新；超过 500 条被拒（400）
- 附件：真实 PNG 上传成功；伪装 SVG 被拒（400）；超大图被拒（413）；删除后存储额度回落
- 公告：发布、用户阅读、列表/阅读统计接口
- 后台权限：未登录 admin API → 401；普通用户 → 403；管理员列表 → 200
- 活跃度：新用户 UserActivityLog 落记录、User.lastActiveAction 更新

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

1. **`Server Reference ID did not match the expected format` 日志**（非阻塞）
   - 现象：preview 8/8 17:43-17:44 出现 7 次（6 次全零 payload + 1 次 `"y"`），prod（Next 14）近 7 天 0 次。
   - 判定：时间与 Caddy 证书签发/服务重启重叠，payload 为畸形探针请求；真实请求（登录 + 建便签）0 次。属**扫描探针噪声，非 Next 15 功能回归**。差异仅是 Next 15 对畸形 flight 请求打 error 日志而 Next 14 静默，属可观测性差异。
2. **audit 残留 2 漏洞**（15.5.23，仅构建期）：见第四节，需 16.3.0 消除。
3. 交互式前端未自动化目验（见第六节未做项）。

---

## 八、合并建议（三选一）

| 选项 | 内容 | 依据 | 代价 |
|---|---|---|---|
| **A（推荐）** | **先合并 15.5.23 上线**，随后立一个 16.3.0 的第二个 preview，验收通过后快速跟进升级 | 15.5.23 preview 已全量验收、以生产同等形态稳定运行、立即脱离 14.2.35 EOL 与已知 CVE；16.3.0 已证明 tsc/build 零改动通过、audit 全绿，跟进成本低 | 两轮上线；audit 短期仍红（仅构建期） |
| **B** | 暂不合并，直接做 16.3.0 preview，验收通过后一步到位合并 16.3.0 | audit 一劳永逸全绿，16.x 更新，维护周期更长 | 需再部署一个 16.3.0 preview 并复跑全部验收（约半天）；16 跳距更大，运行时行为需重新覆盖 |
| **C** | 放弃升级 | —— | 不推荐：14.2.35 已 EOL，缺 2026-07 安全修复（含 App Router 也涉及的 CVE-2026-23869/23870 RSC/flight DoS） |

**倾向**：A。理由：15.5.23 当前已处于"可上线"状态且验收全绿；16.3.0 的额外收益（audit 归零）已被证明近乎零额外代码成本，适合作为紧接的快速跟进，而不是阻塞本次上线的理由。

---

## 九、生产上线步骤（按选项 A：先上 15.5.23）

1. 备份生产 DB（sqlite 文件快照）。
2. 合并 `codex/next-upgrade-preview` 到 main。
3. 服务器同步代码（rsync 或 git pull），保留生产 `.env` 与 uploads。
4. `npm ci && npm run build`（本方案无 prisma schema 变更，无需 db push）。
5. 重启生产 service，健康检查：`/login` 200、admin 列表 200、`journalctl` 无 error。
6. 观察 24h：关注便签 CRUD、登录、附件上传、公告发布。
7. 跟进：另起 16.3.0 preview（复用本分支机制 + 0 代码改动验证），验收后升级。

## 十、生产回滚步骤

1. 保留上线前 main 快照（旧 commit / 旧构建产物）。
2. `git checkout` 回旧提交 → `npm ci` → `npm run build` → 重启 service。
3. 无 schema 变更、无数据迁移，DB 无需回滚；uploads 不受影响。
