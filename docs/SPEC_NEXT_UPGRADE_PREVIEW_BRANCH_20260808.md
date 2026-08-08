# Next.js 架构升级评估：独立分支与体验环境方案

日期：2026-08-08
关联文档：
- `docs/SECURITY_AUDIT_M10_11_20260808.md`
- `docs/交付报告-安全审计整改_20260808.md`

## 一、结论

Next.js 架构升级需要做，但**不能直接在生产 `main` 上做**，也不能在当前已有用户的线上环境里试错。

本轮决策：

1. 线上生产环境保持当前稳定版本不变。
2. 技术部另拉独立升级分支，单独完成 Next 升级、适配、构建和回归。
3. 升级分支部署到独立 preview 体验环境，供产品侧和技术侧验证。
4. preview 未通过完整验收前，不合并 `main`，不部署生产。
5. preview 环境禁止直接写生产数据库，必须使用测试库或生产数据库备份副本。

这不是“立即升级上线”，而是“用可回滚、可验收、可放弃的方式做升级评估”。

## 二、为什么需要单独做

当前第一轮安全整改已经处理了登录频控、注册/重置密码 CPU DoS、附件真实图片校验、输入上限、维护接口密钥等直接业务风险。

但依赖层仍有 Next.js 14 的安全债：

- 当前 `package.json` 使用 `next: ^14.2.0`。
- npm 官方 registry 显示 `next-14` 最新停在 `14.2.35`，`latest` 为 `16.3.0`，`backport` 为 `15.5.23`。
- Next 官方 2026-07 安全发布修复版本为 15.5.x 与 16.2.x 之后版本，Next 14 不在修复线内。
- 本项目使用 App Router，因此即使没有 Server Actions、Image Optimizer、middleware、rewrites，仍存在 RSC/flight 相关攻击面。

风险性质：

- 更偏向服务可用性风险，例如构造请求导致 Node 进程 CPU/内存压力升高、页面变慢、请求超时。
- 不是当前最容易导致数据泄露的风险。
- 邀请制、小用户量、Caddy 反代、请求体限制、频控可以降低风险，但不能根治依赖漏洞。

所以升级是必要的，但不能混入普通功能迭代，也不能直接冲生产。

参考：
- Next.js July 2026 Security Release: https://nextjs.org/blog/july-2026-security-release
- GitHub Advisory GHSA-q4gf-8mx6-v5v3: https://github.com/advisories/GHSA-q4gf-8mx6-v5v3

## 三、目标

### 目标内

1. 新建独立升级分支。
2. 在分支内评估 Next 15.5.x 与 Next 16.x 两条路径。
3. 完成必要代码适配：
   - route handler `params` 异步化。
   - `cookies()` / `headers()` 等 Next API 的异步适配。
   - 构建、运行、PWA/service worker、Tailwind/PostCSS 兼容修复。
4. 单独部署 preview 体验环境。
5. 使用测试数据或生产备份副本完成全流程验收。
6. 输出升级评估报告：
   - 选型版本。
   - 改动清单。
   - 验收结果。
   - 已知风险。
   - 是否建议合并 `main`。
   - 生产上线和回滚步骤。

### 目标外

本分支不得顺手做以下事情：

1. 不新增产品功能。
2. 不改业务流程。
3. 不改数据库 schema，除非发现框架升级绝对要求；如必须改，需单独提交决策。
4. 不改用户数据结构。
5. 不重写认证、附件、公告、管理员后台等核心模块。
6. 不直接部署覆盖生产。
7. 不直接连接生产库做写入验证。

## 四、分支策略

建议分支：

```bash
git checkout main
git pull
git checkout -b codex/next-upgrade-preview
```

要求：

1. 分支只用于 Next 升级与兼容性修复。
2. 每一类修复独立 commit，便于回退和审查。
3. 不允许把未完成的升级分支合并进 `main`。
4. 若升级尝试失败，保留分支和报告即可，不影响生产。

建议 commit 粒度：

1. `chore: upgrade next dependency for preview evaluation`
2. `fix: adapt next async request APIs`
3. `fix: restore build/runtime compatibility`
4. `test: add/record next upgrade regression checks`
5. `docs: add next upgrade evaluation report`

## 五、版本评估路线

### 路线 A：优先评估 Next 15.5.x

适用目标：

- 优先获得官方安全修复。
- 降低升级跨度。
- 尽量保持现有 React/Tailwind/构建行为稳定。

注意：

- npm audit 可能仍显示部分 high，需区分“官方已修复但 npm advisory 数据滞后”与“真实未修复”。
- 如 audit 无法接受，则继续评估路线 B。

### 路线 B：评估 Next 16.x

适用目标：

- 追求 `npm audit --omit=dev` 全绿。
- 接受更完整的大版本回归成本。

注意：

- Next 16 默认构建链变化更大，需要重点验证 Turbopack、Tailwind、PostCSS、PWA/service worker。
- 即使 React peer 兼容，也不建议顺手升 React，除非 Next 16 路径明确要求。

### 推荐顺序

1. 先建分支。
2. 先试 Next 15.5.x，记录真实改动量和 audit 结果。
3. 如果 Next 15.5.x 构建稳定但 audit 仍无法接受，再试 Next 16.x。
4. 最终选择以“preview 实测稳定 + 安全收益明确 + 可回滚”为准。

## 六、preview 环境要求

preview 环境必须和生产隔离。

建议：

| 项目 | 生产 | preview |
|---|---|---|
| 分支 | `main` | `codex/next-upgrade-preview` |
| 端口 | 现有生产端口 | 新端口，例如 `9012` |
| 域名 | 当前正式域名 | `preview.*` 或临时域名 |
| 数据库 | `prod.db` | `preview.db` |
| 上传目录 | 生产 uploads | preview uploads |
| systemd service | 现有服务 | 新 service |
| Caddy site | 现有站点 | 新 preview site |
| 日志 | 生产日志 | preview 单独日志 |

硬性要求：

1. preview 不得写生产 `prod.db`。
2. preview 不得使用生产上传目录。
3. preview 不得复用生产 systemd service。
4. preview 可使用生产数据库备份副本，但必须复制成独立文件后再启动。
5. preview 邮件发送如会触达真实用户，必须关闭或改为测试收件箱。
6. preview 管理员账号可用，但不得对真实用户产生通知、邮件或数据变更。

## 七、数据保护要求

上线已有用户后，升级评估的第一原则是保护用户数据。

执行前必须准备：

1. 生产数据库备份。
2. 生产上传目录备份或快照。
3. 当前线上 commit hash。
4. 当前 `package-lock.json`。
5. 当前 `.env`。
6. 当前 Caddy 配置。
7. 当前 systemd service/timer 配置。

preview 数据策略：

1. 首选测试库。
2. 如需要真实数据结构验证，使用生产 DB 备份副本。
3. 使用备份副本前可脱敏邮箱、昵称等字段。
4. preview 里的写入、删除、改密、上传都只作用于副本。
5. 任何 schema 变更都必须先在副本上演练并记录。

## 八、必须验证的业务流程

### 基础构建

- `npm install` 或 `npm ci` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- `npm run start` 可启动。
- 服务器日志无 Next runtime error。

### 认证

- 登录成功。
- 错误密码频控仍生效。
- 注册邀请码流程正常。
- 注册后示例便签正常生成。
- 忘记密码/重置密码流程正常。
- 修改密码正常。
- 禁用用户无法继续操作。
- `/api/auth/me` 未登录返回 401。

### 便签

- 新建文本便签。
- 编辑标题。
- 编辑正文。
- 切换颜色。
- 置顶/取消置顶。
- 删除到回收站。
- 恢复。
- 永久删除。
- 归档/取消归档。
- 搜索。

### 待办

- 新建 checklist 便签。
- 多行粘贴生成待办。
- 勾选/取消勾选。
- 分组/标题行解析正常。
- 超长输入限制仍生效。

### 附件

- 上传真实 PNG/JPEG/WebP/GIF。
- 伪装图片被拒绝。
- 超大图片被拒绝。
- 删除附件后数据库和文件一致。
- 存储额度更新正确。

### 公告

- 管理员新建草稿。
- 发布公告。
- 用户登录后弹窗展示一次。
- 已读后不重复弹。
- 管理员后台阅读统计正确。

### 管理员后台

- 未登录访问 admin API 返回 401。
- 普通用户访问 admin API 返回 403。
- 管理员用户列表正常。
- 用户状态、额度、活跃度展示正常。
- 反馈列表正常。
- 公告管理正常。
- 删除废用户规则仍符合 M10.10 补丁逻辑。

### M10.11 活跃度

- 登录记录 `login`。
- 新建记录 `create_note`。
- 编辑记录 `edit_note`。
- 勾选待办记录 `check_todo`。
- 归档/取消归档记录正确。
- 删除/恢复/永久删除记录正确。
- 上传/删除附件记录正确。
- 公告已读记录正确。
- 管理员列表今日/近 7 天统计正确。

### 前端体验

- 首页首屏可用。
- 左侧便签列表正常。
- 编辑器不白屏。
- 弹窗、菜单、三点按钮正常。
- 320px/390px 窄屏无横向溢出。
- 浅色/深色主题正常。
- PWA/service worker 不报错。

### 桌面壳

如当前桌面壳仍使用同一 Web 入口，必须验证：

- Windows 壳能打开 preview 或本地升级版。
- 登录态正常。
- 窄窗口布局正常。
- 置顶/浮窗相关功能不受影响。
- 文件下载入口不受影响。

## 九、上线前合并门槛

升级分支只有满足以下条件，才允许提议合并 `main`：

1. preview 环境连续稳定运行至少 24 小时。
2. 构建、启动、核心 API、核心 UI 全部通过。
3. 产品侧实际体验通过。
4. 技术侧完成数据副本验证。
5. 没有阻塞级 runtime error。
6. 没有用户数据写错、丢失、串号、附件路径错误。
7. 已提交升级评估报告。
8. 已准备生产回滚方案。
9. 已明确是否需要 DB schema 变更；若需要，必须另行审批。

任何一个不满足，都不得合并。

## 十、生产上线方案

只有 preview 通过后，才进入生产上线。

上线步骤：

1. 选择低峰时间。
2. 通知产品侧准备验收。
3. 停止生产写入窗口，或至少确认当前用户量很低。
4. 备份生产数据库。
5. 备份上传目录。
6. 记录当前线上 commit。
7. 拉取已合并的 `main`。
8. `npm ci`。
9. `npm run build`。
10. 重启生产服务。
11. 健康检查：
    - `/login` 200。
    - `/api/auth/me` 未登录 401。
    - 管理员登录成功。
    - 管理员用户列表 200。
    - 日志无 Next runtime error。
12. 用测试账号跑核心流程。
13. 产品侧确认后结束上线窗口。

## 十一、回滚方案

如果生产升级后出现白屏、无法登录、核心 API 500、附件不可用、数据异常，立即回滚。

回滚步骤：

1. 切回升级前 commit。
2. 恢复升级前 `package-lock.json`。
3. `npm ci`。
4. `npm run build`。
5. 重启服务。
6. 健康检查 `/login`、`/api/auth/me`、管理员后台。
7. 若本次升级没有 schema 变更，原则上不需要恢复数据库。
8. 若本次升级发生 schema 变更，按上线前 DB 备份恢复，并单独记录事故原因。

回滚验收：

- 用户能登录。
- 历史便签可见。
- 新建/编辑/删除便签正常。
- 附件可访问。
- 管理员后台正常。
- 日志无持续 500。

## 十二、不升级期间的生产降险

在升级分支评估期间，生产仍可先做低风险边缘加固：

1. Node 服务只绑定 `127.0.0.1`，不要绑定 `0.0.0.0` 或 `*:9002`。
2. Caddy 请求体上限从 10MB 收到 6MB。
3. Caddy 拒绝无用 WebSocket Upgrade。
4. Caddy 补安全响应头：
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: same-origin`
   - `X-Frame-Options: DENY` 或 CSP `frame-ancestors 'none'`
   - `Permissions-Policy` 最小化
5. 增加 CPU、内存、5xx、请求量告警。
6. 对匿名请求做粗粒度 IP 限流。

这些措施不能替代升级，但能降低升级评估期间的暴露。

## 十三、交付物

技术部完成后需交付：

1. 升级分支名与 commit 列表。
2. preview 访问地址。
3. preview 数据源说明，明确不是生产库写入。
4. 依赖版本对比：
   - Next
   - React
   - PostCSS
   - sharp
   - nanoid
5. `npm audit --omit=dev` 结果。
6. `npx tsc --noEmit` 结果。
7. `npm run build` 结果。
8. 全流程验收清单。
9. 已知问题清单。
10. 是否建议合并 `main` 的明确结论。
11. 生产上线步骤。
12. 生产回滚步骤。

## 十四、验收结论模板

技术部最终报告必须给出以下三选一结论：

### A. 建议合并上线

条件：

- preview 全流程通过。
- 没有阻塞问题。
- 回滚方案完整。
- 产品侧体验通过。

### B. 暂不合并，继续修复

条件：

- 构建或关键流程存在问题。
- 但问题可定位、可继续修复。

### C. 放弃本轮升级

条件：

- 升级成本明显超过收益。
- 核心流程不稳定。
- 桌面壳或生产部署方式存在大面积不兼容。

如选择 C，生产继续保留当前版本，并落实第十二节生产降险。
