# PinNote 上线后安全审计报告（M10.11 前）

日期：2026-08-08  
范围：当前仓库 `src/app/api`、`src/lib`、`prisma/schema.prisma`、`package.json`、`next.config.mjs`。  
目的：上线后全面检查 AI coding 迭代可能留下的安全风险，给技术部形成整改清单。

## 1. 总体结论

当前代码在“用户数据隔离”这一核心边界上整体是正向的：

- 大多数业务 API 都使用 `authOrResponse()` 或 `requireAdmin()`。
- 便签、附件、回收站、归档、批量操作基本都按 `session.userId` 过滤。
- 管理员接口基本走 `requireAdmin()`。
- 文件读取接口已有路径穿越检查和附件归属校验。
- `.env` 未被 git 跟踪，仓库只跟踪 `.env.example`。

但上线后仍有几类需要尽快补：

1. 依赖版本存在高危审计告警，尤其 Next.js。
2. 登录、注册、重置密码等认证入口缺少统一频控，存在爆破和低成本 DoS 风险。
3. 状态变更接口没有 CSRF/Origin 防护，后台危险操作尤其需要补。
4. 普通图片附件上传只信浏览器 MIME，`sharp` 识别失败仍会落盘。
5. 维护接口 `/api/trash-cleanup` 的 loopback 判断在直连或头部可伪造场景下不够硬。
6. 便签字段和 checklist 缺少明确长度/数量上限，容易被超大 payload 拖垮。

## 2. 风险清单

### P0-1：依赖审计存在高危告警，Next.js 需要升级

证据：

- `package.json:22` 使用 `next: ^14.2.0`。
- 当前实际安装为 `next@14.2.35`。
- `npm audit --registry=https://registry.npmjs.org` 返回 3 个高危聚合项：`next`、`postcss`、`nanoid`。
- 审计中 Next.js 命中多条 DoS、SSRF、cache poisoning、request smuggling、Server Actions 相关公告。

影响：

- 即使业务代码没有显式使用相关功能，框架层漏洞仍应按生产安全风险处理。
- 这是上线项目最优先处理项。

建议：

1. 优先升级到 Next 官方已修复版本。当前 audit 给出的自动修复目标是 `next@16.3.0`，但这是 major 升级，技术部需要评估 React/Next 兼容成本。
2. 如果无法立刻升 16，至少确认 Next 14/15 是否存在对应 backport 修复版本，并锁定到不再触发高危 audit 的版本。
3. 同步升级 `postcss` 到修复版本，并确认 `next` 内部依赖不再携带脆弱版本。
4. 升级后必须跑：
   - `npm audit --registry=https://registry.npmjs.org`
   - `npx tsc --noEmit`
   - `npm run build`
   - 登录、便签、上传、公告、管理员后台主流程回归。

验收：

- `npm audit --audit-level=high` 不再报告 high/critical。

### P0-2：登录接口无频控，存在密码爆破风险

证据：

- `src/app/api/auth/login/route.ts:7-60` 登录失败直接 bcrypt 比对并返回，没有调用 `rateLimit()`。
- `src/lib/rateLimit.ts:1-17` 已有内存级频控工具，但登录未使用。

影响：

- 攻击者可以持续尝试管理员或内测用户密码。
- 对已存在用户名/邮箱还会触发 bcrypt，比普通请求更耗 CPU。

建议：

1. 登录接口增加双维度频控：
   - IP 维度：例如 10 次 / 10 分钟。
   - 账号维度：例如 5 次 / 10 分钟。
2. 超限返回 `429 RATE_LIMITED`。
3. 登录成功后可以清理该账号失败计数，或等待窗口自然过期。
4. 失败响应继续保持 `INVALID_CREDENTIALS`，不要暴露账号是否存在。

验收：

- 同一 IP 连续失败超过阈值返回 429。
- 同一账号连续失败超过阈值返回 429。
- 正确密码在未超限时仍可登录。

### P0-3：注册接口无频控，且在邀请码校验前先 bcrypt，存在低成本 CPU DoS

证据：

- `src/app/api/auth/register/route.ts:74-75` 先执行 `bcrypt.hash(password, 10)` 和邀请码 hash。
- `src/app/api/auth/register/route.ts:81-88` 之后才查邀请码是否有效。
- 注册接口没有使用 `rateLimit()`。

影响：

- 攻击者不需要有效邀请码，只要提交随机邮箱/密码/邀请码，就能反复触发 bcrypt。
- 这是公开接口，DoS 成本较低。

建议：

1. 注册接口先校验邀请码是否存在、active、未过期、未使用，再执行 bcrypt。
2. 增加 IP 维度频控：例如 5 次 / 10 分钟。
3. 增加 inviteCode hash 维度频控，防止暴力猜邀请码。
4. 保留邮箱唯一约束兜底。

验收：

- 无效邀请码请求不会触发 bcrypt。
- 连续注册失败达到阈值返回 429。
- 有效邀请码正常注册。

### P1-1：状态变更接口缺少 CSRF / Origin 防护

证据：

- session cookie 使用 `sameSite: "lax"`，见 `src/lib/session.ts:24-32`。
- 多数状态变更 API 只依赖 cookie session，例如 notes、admin、announcements、users、feedback。
- 代码中没有看到统一 Origin 校验、CSRF token 或双提交 cookie。

影响：

- 现代浏览器的 SameSite=Lax 已降低跨站 POST 风险，但不是完整 CSRF 设计。
- 管理员危险操作，如禁用用户、删除用户、发布公告、重置密码，最好有额外防护。

建议：

1. 对所有非 GET API 统一校验 `Origin` / `Referer`，必须匹配生产域名。
2. 管理员危险操作再加 CSRF token 更稳。
3. 桌面壳/Tauri 如有特殊 Origin，需要明确白名单。

验收：

- 从非本站 Origin 发起 POST/PATCH/DELETE 返回 403。
- 正常网页端和桌面端操作不受影响。

### P1-2：普通附件上传只信 MIME，伪装文件会落盘

证据：

- `src/app/api/notes/[id]/attachments/route.ts:67-72` 只校验 `file.type`。
- `src/app/api/notes/[id]/attachments/route.ts:125-127` 在 sharp 元数据校验前已写文件。
- `src/app/api/notes/[id]/attachments/route.ts:132-138` sharp 解析失败只是忽略，仍创建 Attachment 记录。

影响：

- 用户可以上传伪装成图片的非图片文件。
- 读取时 Content-Type 根据扩展返回，浏览器通常不会执行图片 MIME 下的脚本，但这仍是文件投毒和存储滥用风险。
- 与头像上传相比，头像已做真实图片校验和压缩，普通附件安全标准偏低。

建议：

1. 先 `Buffer.from(await file.arrayBuffer())`。
2. 用 `sharp(buffer).metadata()` 校验真实图片；失败直接 400，不落盘。
3. 限制原始尺寸，例如宽高不超过 8192 或按产品取更小。
4. 可选：像头像一样统一转 webp/压缩，降低存储和解析风险。
5. 写库失败时删除已写文件，避免孤儿文件。

验收：

- 上传 `.exe` / 文本文件伪装 `image/png` 返回 400，磁盘无文件残留。
- 正常 jpg/png/webp/gif 按预期上传。

### P1-3：重置密码接口无频控，且无效 token 也会先 bcrypt

证据：

- `src/app/api/auth/reset-password/route.ts:45-48` 先 hash token 并执行 `bcrypt.hash(newPassword, 10)`。
- `src/app/api/auth/reset-password/route.ts:50-64` 之后才原子 claim token。
- 该接口没有频控。

影响：

- 攻击者可以提交随机 token 和新密码，反复消耗 bcrypt CPU。
- 虽然不能直接重置他人密码，但可造成认证相关接口资源压力。

建议：

1. 先查 tokenHash 是否存在、未用、未过期，再执行 bcrypt。
2. 增加 IP 维度频控，例如 5 次 / 10 分钟。
3. token 不存在/过期/已用继续返回统一或低信息错误，避免枚举价值过高。

验收：

- 随机 token 请求不会触发 bcrypt。
- 连续失败达到阈值返回 429。

### P1-4：维护接口 loopback 判断依赖 `x-forwarded-for`，直连或伪造头场景不够硬

证据：

- `src/app/api/trash-cleanup/route.ts:13-17` 读取 `x-forwarded-for` 并判断首个 IP。
- `src/app/api/trash-cleanup/route.ts:17-22` 只有在 `forwarded` 存在且不是 loopback 时拒绝。
- 如果请求没有 `x-forwarded-for`，会继续执行清理。

影响：

- 如果 Next 服务端口意外暴露到公网，外部请求不带 `x-forwarded-for` 也能触发清理。
- 即使清理只针对过期回收站，仍属于未授权维护操作。

建议：

1. 该接口改为要求维护密钥，例如 `Authorization: Bearer $TRASH_CLEANUP_SECRET`。
2. 或只绑定 127.0.0.1，并在 Caddy/Nginx 层禁止公网访问该路径。
3. 不建议只依赖客户端可控 header。

验收：

- 无密钥请求返回 403。
- 错误密钥返回 403。
- 正确密钥或本机定时任务正常执行。

### P1-5：便签内容/checklist 缺少明确长度和数量上限

证据：

- `src/app/api/notes/route.ts:66-123` 新建便签没有校验 `title/content` 类型和长度。
- `src/app/api/notes/[id]/route.ts:49-60` PATCH 允许多字段，但多数没有类型和范围校验。
- `src/lib/note-serializer.ts:156-179` checklistItems 只校验结构，不限制数组长度、单项文本长度。

影响：

- 超大 JSON body 会先被 `request.json()` 读入内存。
- 超长标题/正文/checklist 可导致数据库膨胀、序列化慢、前端渲染卡顿。
- 存储额度能拦住入库后的总量，但不能完全防止单次请求解析压力。

建议：

1. 增加业务上限：
   - 标题 ≤ 200 字。
   - 正文 ≤ 50,000 字或更小。
   - checklistItems ≤ 500 条。
   - 单条待办文本 ≤ 1,000 字。
   - checklistGroups ≤ 100。
2. 对 `isPinned/isArchived/alwaysOnTop` 校验 boolean。
3. 对窗口坐标/尺寸校验 number + 合理范围。
4. 对 `q` 搜索参数加长度上限，例如 100 字。

验收：

- 超长字段返回 400，不写库。
- 正常长便签仍可保存。

### P1-6：管理员危险操作缺少审计日志

证据：

- 管理员可禁用用户、调额度、重置密码、删除用户、发布/归档公告、作废邀请码。
- 当前 M10.11 只记录用户活跃日志，未记录管理员操作日志。

影响：

- 内测期间如果发生误删、误重置密码、误发布公告，事后难以追责和复盘。
- 这不是立即被外部攻击的漏洞，但对上线运营很重要。

建议：

1. 新增 `AdminAuditLog`：
   - adminUserId
   - action
   - targetType
   - targetId
   - createdAt
   - metadata（不含密码明文）
2. 覆盖危险操作：
   - 禁用/启用用户
   - 删除用户
   - 调整额度
   - 重置密码（只记录动作，不记录密码）
   - 生成/作废邀请码
   - 发布/归档公告
3. 管理后台后续可展示最近 100 条。

验收：

- 每个管理员危险操作都有审计记录。
- 审计日志不保存密码、邀请码明文。

### P2-1：文件删除路径未统一使用 safeResolve

证据：

- 文件读取接口有 `path.relative` 防逃逸，见 `src/app/api/files/[...path]/route.ts:16-24`。
- 永久删除使用 `path.resolve(uploadDir, att.storagePath)`，见 `src/lib/permanent-delete.ts:32-45`。
- 删除废用户使用 `path.resolve(uploadDir, rel)`，见 `src/app/api/admin/users/[id]/route.ts:109-130`。

影响：

- 当前 storagePath 由服务端生成，正常情况下风险不高。
- 但如果未来某个上传/迁移/DB 修复写入了异常 storagePath，删除流程可能删除 uploadDir 外文件。

建议：

1. 抽公共 `safeResolveUploadPath(uploadDir, rel)`。
2. 所有读、删、复制文件都统一使用。
3. resolve 失败则跳过文件并记录服务端日志。

### P2-2：用户资料 PATCH 使用 getSession，禁用旧 session 仍可能改资料

证据：

- `src/app/api/auth/me/route.ts:19-27` PATCH 只检查 `getSession()` 是否有 userId。
- 没有像其他业务接口一样用 `authOrResponse()` 或重新检查 `status === active`。

影响：

- 如果用户被管理员禁用，但浏览器旧 session 仍在，理论上仍可修改 displayName/avatarColor。
- 影响较小，但与“禁用后不能操作”的全局口径不一致。

建议：

- 将 `PATCH /api/auth/me` 改为 `authOrResponse()`。

### P2-3：安全响应头较少

证据：

- `next.config.mjs:3-13` 仅对 `/sw.js` 设置了 `Content-Type` 和 `Cache-Control`。
- 未配置 CSP、`X-Frame-Options`/`frame-ancestors`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`。

影响：

- 当前 React 默认转义降低 XSS 风险，但缺少浏览器层兜底。
- 登录态应用建议补安全响应头。

建议：

1. 增加全站：
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: same-origin`
   - `X-Frame-Options: DENY` 或 CSP `frame-ancestors 'none'`
   - `Permissions-Policy` 关闭不需要的能力
2. CSP 需要小心现有内联主题脚本：`src/app/layout.tsx:20-24` 使用 `dangerouslySetInnerHTML`。可先不一步到位强 CSP，或给内联脚本加 nonce/hash。

### P2-4：内存频控不是生产级

证据：

- `src/lib/rateLimit.ts:1-17` 使用进程内 Map。
- 注释说明“单进程内生效，进程重启即清零”。

影响：

- 单机单进程可以先用，但重启清零，未来多实例不共享。
- 当前忘记密码已使用它，未来登录/注册也会依赖它。

建议：

1. 内测期可接受，但要加 `pruneRateLimits()` 调用或周期清理。
2. 后续上 Redis / SQLite 持久频控。
3. 频控 key 的 IP 来源应由可信反代注入，不能完全信用户传入 header。

## 3. 未发现明显问题的点

本次没有看到以下高危问题：

1. 未发现 Prisma `$queryRaw` / `$executeRaw` 拼接 SQL。
2. 未发现普通用户 notes API 可直接跨 userId 访问他人便签。
3. 未发现附件读取缺少 DB 归属校验。
4. 未发现公告/反馈/便签内容使用用户输入的 `dangerouslySetInnerHTML` 渲染；唯一 `dangerouslySetInnerHTML` 是静态主题脚本。
5. `.env` 未被 git 跟踪。

## 4. 建议整改顺序

### 第一批：必须尽快做

1. 升级 Next/PostCSS，清掉 high/critical audit。
2. 登录频控。
3. 注册频控 + 邀请码先校验再 bcrypt。
4. 重置密码频控 + token 先校验再 bcrypt。
5. 普通附件上传真实图片校验，失败不落盘。

### 第二批：上线安全加固

1. CSRF/Origin 防护。
2. `/api/trash-cleanup` 改维护密钥或反代层封死。
3. 便签/checklist/search 输入上限。
4. `PATCH /api/auth/me` 改用 active session 校验。

### 第三批：运营审计

1. AdminAuditLog。
2. 文件操作统一 safeResolve。
3. 安全响应头。
4. 频控持久化。

## 5. 回归验收清单

安全整改后至少验收：

1. `npm audit --audit-level=high --registry=https://registry.npmjs.org` 无 high/critical。
2. 登录连续失败触发 429，正确密码仍可登录。
3. 无效邀请码注册不会触发 bcrypt 压力，连续失败触发 429。
4. 随机 reset token 请求不会触发 bcrypt 压力，连续失败触发 429。
5. 伪装图片上传失败且磁盘无残留。
6. 跨站 Origin 调用管理接口返回 403。
7. 正常网页端和桌面端登录、编辑、上传、反馈、公告、管理员后台不回退。
8. 禁用用户旧 session 不能修改资料。
9. 维护接口无密钥访问返回 403。

## 6. 备注

本报告基于当前本地仓库静态审计和 `npm audit`。生产环境仍需另查：

- Caddy/Nginx 是否只暴露 HTTPS 域名，不暴露 Node 端口。
- 生产 `SESSION_SECRET` 是否足够随机且未复用示例值。
- 生产 `APP_BASE_URL` 是否为 HTTPS 正式域名。
- 上传目录权限是否仅服务进程可写。
- 数据库备份文件是否不在 Web 可访问目录。
