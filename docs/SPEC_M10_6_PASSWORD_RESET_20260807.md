# PinNote M10.6 忘记密码与邮件重置

日期：2026-08-07

## 1. 背景

M10.1 已完成账号地基与数据隔离。

M10.2 已完成登录入口、昵称/文字头像。

M10.3 已完成存储额度。

M10.4 已完成管理员最小管理，管理员已可手动重置用户密码。

M10.5 已完成邀请制注册，新用户使用 `email + password` 注册并可用邮箱登录。

现在可以补上用户自助“忘记密码”能力。但本轮只做邮件重置密码 MVP，不做复杂账号安全平台。

## 2. 产品决策

### 2.1 支持有邮箱用户自助重置

M10.6 仅对有 `email` 的用户提供自助找回密码。

老账号 `admin` 如果没有 email，继续通过 M10.4 管理员重置密码处理，不强制本轮给 admin 绑定 email。

### 2.2 不暴露账号是否存在

用户提交邮箱后，无论邮箱是否存在，都显示同一句：

```text
如果该邮箱已注册，我们会发送密码重置邮件。
```

原因：

1. 防止枚举已注册邮箱。
2. 降低账号探测风险。

### 2.3 token 只用一次，短期有效

重置链接默认：

```text
有效期：30 分钟
只能使用一次
```

重置成功后 token 立即失效。

## 3. 本轮目标

M10.6 做五件事：

1. 新增 PasswordResetToken 数据模型。
2. 新增忘记密码请求接口，发送重置邮件。
3. 新增重置密码页面和提交接口。
4. 配置 SMTP 邮件发送。
5. 重置成功后让旧密码失效，并清理该用户其他未使用 reset token。

## 4. 本轮不做

明确不做：

1. 不做邮箱验证注册。
2. 不做手机号找回。
3. 不做微信/OAuth 绑定。
4. 不做多因素认证。
5. 不做复杂风控后台。
6. 不做用户自行改邮箱。
7. 不做公开注册。
8. 不做短信发送。

## 5. 数据模型

新增：

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}
```

在 `User` 上增加反向关系：

```prisma
passwordResetTokens PasswordResetToken[]
```

安全要求：

1. 数据库只保存 `tokenHash`。
2. 邮件链接里使用明文 token。
3. 明文 token 只出现在邮件链接中，不写入数据库。
4. token 过期或已使用后不能再用。

## 6. 环境变量

新增 SMTP 配置：

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
APP_BASE_URL
```

说明：

1. `APP_BASE_URL` 用于生成重置链接，例如 `https://xxx.com/reset-password?token=...`
2. 生产环境缺 SMTP 配置时，忘记密码接口应返回通用成功文案，但服务端记录错误，不能崩溃。
3. 不要把 SMTP 密码写入 git。

如果技术部选用 Resend / SendGrid 等服务，也可以替代 SMTP，但必须在交付报告里写明配置项。

## 7. API 设计

### 7.1 请求重置邮件

```text
POST /api/auth/forgot-password
```

请求：

```json
{
  "email": "user@example.com"
}
```

返回：

```json
{
  "ok": true,
  "message": "如果该邮箱已注册，我们会发送密码重置邮件。"
}
```

要求：

1. email trim + 小写。
2. 无论用户是否存在，都返回 200 + 通用文案。
3. 如果用户不存在，不发送邮件。
4. 如果用户存在但 `status=disabled`，不发送邮件，但仍返回通用文案。
5. 如果用户存在且 active，生成 reset token 并发送邮件。
6. 同一邮箱请求频率需要限制。

### 7.2 提交新密码

```text
POST /api/auth/reset-password
```

请求：

```json
{
  "token": "plain-token-from-email",
  "newPassword": "new-password"
}
```

成功：

```json
{
  "ok": true,
  "message": "密码已重置，请重新登录。"
}
```

失败错误码：

```text
INVALID_RESET_TOKEN
RESET_TOKEN_EXPIRED
RESET_TOKEN_USED
PASSWORD_TOO_SHORT
ACCOUNT_DISABLED
```

要求：

1. token 必须 hash 后查库。
2. token 不存在返回 `INVALID_RESET_TOKEN`。
3. token 已使用返回 `RESET_TOKEN_USED`。
4. token 过期返回 `RESET_TOKEN_EXPIRED`。
5. 用户 disabled 返回 `ACCOUNT_DISABLED`。
6. 密码最少 8 位。
7. 成功后 bcrypt hash 新密码。
8. 成功后设置当前 token `usedAt=now`。
9. 成功后清理或作废该用户其他未使用 reset token。
10. 成功后不自动登录，要求用户重新登录。

## 8. Token 规则

### 8.1 生成

建议：

```text
crypto.randomBytes(32).toString("base64url")
```

token hash：

```text
sha256(token)
```

有效期：

```text
30 分钟
```

### 8.2 重复请求策略

同一用户重复请求忘记密码时：

```text
允许生成新 token，同时作废旧的未使用 token。
```

这样用户只需要使用最新邮件。

### 8.3 频率限制

本轮必须做最小频控。

建议：

```text
同一 email：1 分钟内最多 1 次
同一 IP：10 分钟内最多 5 次
```

如果当前项目没有通用 rate limit 基础设施，可先做数据库级或内存级最小限制，但交付报告要写清楚限制范围。

## 9. 邮件内容

邮件标题：

```text
重置你的 PinNote 密码
```

邮件正文：

```text
你正在重置 PinNote 密码。

点击下面的链接设置新密码：
<reset link>

该链接 30 分钟内有效，且只能使用一次。
如果不是你本人操作，可以忽略这封邮件。
```

要求：

1. 不包含旧密码。
2. 不包含 passwordHash。
3. 不包含过多账号信息。
4. reset link 必须使用 `APP_BASE_URL`。

## 10. UI 设计

### 10.1 登录页入口

登录页增加：

```text
忘记密码？
```

位置建议：

```text
登录按钮下方，与“使用邀请码注册”并列或上下排列。
```

### 10.2 忘记密码页

路径：

```text
/forgot-password
```

字段：

```text
邮箱
```

提交后显示通用成功状态：

```text
如果该邮箱已注册，我们会发送密码重置邮件。
```

不要显示“邮箱不存在”。

### 10.3 重置密码页

路径：

```text
/reset-password?token=...
```

字段：

```text
新密码
确认新密码
```

要求：

1. token 缺失时显示“链接无效”。
2. 两次密码不一致时前端拦截。
3. 密码少于 8 位时前端拦截。
4. 成功后提示“密码已重置，请重新登录”。
5. 成功后提供“去登录”按钮。

视觉要求：

1. 延续 M9/M10 登录页风格。
2. 390px/320px 不溢出。
3. 错误提示明确但不吓人。

## 11. 安全要求

1. 不暴露邮箱是否存在。
2. token 只存 hash。
3. token 一次性。
4. token 30 分钟过期。
5. reset token 不能出现在服务端日志。
6. 邮件发送失败不能把错误栈返回给用户。
7. 重置密码后旧密码必须立即失效。
8. disabled 用户不能通过重置密码绕过禁用。
9. 不自动登录，减少 token 被盗后的风险。

## 12. 数据安全执行顺序

生产执行顺序：

1. 备份生产数据库。
2. 记录 User / Note / Attachment / InviteCode / PasswordResetToken 数量。
3. `PRAGMA integrity_check = ok`。
4. 配置 SMTP 环境变量。
5. 部署 schema。
6. `prisma db push`。
7. build。
8. 重启服务。
9. 健康检查。
10. 发送测试邮件。
11. 使用测试 token 重置测试用户密码。
12. 清理测试 token / 测试用户。

## 13. 验收标准

### 13.1 数据验收

必须提供：

```text
User: 前 -> 后
Note: 前 -> 后
Attachment: 前 -> 后
InviteCode: 前 -> 后
PasswordResetToken: 前 -> 后
```

通过标准：

1. 历史用户不受影响。
2. 历史 Note / Attachment 不变。
3. PasswordResetToken 测试数据可清理。

### 13.2 忘记密码请求验收

必须通过：

1. 已注册 active email 提交后返回通用成功文案。
2. 未注册 email 提交后也返回同样文案。
3. disabled 用户 email 提交后也返回同样文案，但不发送邮件。
4. active 用户收到邮件。
5. 邮件链接包含 token。
6. 服务端数据库只存 tokenHash。
7. 响应不暴露用户是否存在。
8. 频率限制生效。

### 13.3 重置密码验收

必须通过：

1. 有效 token + 合法新密码可重置成功。
2. 旧密码登录失败。
3. 新密码登录成功。
4. token 二次使用失败。
5. 过期 token 失败。
6. 伪造 token 失败。
7. 短密码失败。
8. disabled 用户 token 不能重置。
9. 成功后不自动登录。

### 13.4 UI 验收

必须通过：

1. 登录页有“忘记密码？”入口。
2. `/forgot-password` 页面可提交邮箱。
3. 提交后通用文案一致。
4. `/reset-password?token=...` 页面可输入新密码。
5. 两次密码不一致前端拦截。
6. 成功后能跳回登录。
7. 390px/320px 不横向溢出。

## 14. 回归验收

必须复测：

1. admin 用户名登录仍可用。
2. 新用户邮箱登录仍可用。
3. 邀请制注册仍可用。
4. 管理员重置密码仍可用。
5. 禁用用户仍不能登录。
6. 普通便签新建/编辑/保存。
7. 图片上传额度仍生效。
8. 账号菜单空间提示仍显示。
9. 断网防丢保护不退化。

## 15. 不通过标准

出现以下任一情况不能通过：

1. 响应暴露邮箱是否存在。
2. token 明文存库。
3. token 可重复使用。
4. token 过期后仍可用。
5. disabled 用户可通过重置密码恢复使用。
6. 重置后旧密码仍可登录。
7. 邮件发送失败导致服务崩溃。
8. reset token 出现在日志或交付报告中。
9. 本轮混入邮箱验证、公开注册、OAuth 等非本轮范围。

## 16. 交付物要求

技术部交付时必须提供：

1. 改动文件清单。
2. schema 变更说明。
3. SMTP 配置项说明，不要泄露密码。
4. 生产数据库备份路径。
5. `db push` 结果。
6. User / Note / Attachment / InviteCode / PasswordResetToken 数量前后对比。
7. 邮件发送验收结果。
8. token hash / 一次性 / 过期验收结果。
9. UI 验收结果。
10. 回归测试结果。
11. 回退方案。

## 17. 回退方案

若出现登录异常、邮件接口异常、历史数据不可见：

```text
停服务
恢复 M10.6 前数据库备份
回退 M10.6 代码
重新 build
重启服务
复查登录和历史便签
```

回退后确认：

1. admin 可登录。
2. 新用户邮箱登录仍可用。
3. 邀请制注册恢复 M10.5 状态。
4. Note 数量恢复。
5. Attachment 数量恢复。

## 18. 后续路线

M10.6 完成后，账号主链路基本闭环。

后续再考虑：

```text
M10.7 邮箱验证注册
M10.8 账号安全与登录频控增强
M10.9 内容治理/举报/禁用细化
```

不建议在 M10.6 里继续扩范围。
