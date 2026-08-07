# PinNote M10.5 邀请制注册

日期：2026-08-07

## 1. 背景

M10.1 已完成账号地基与数据隔离。

M10.2 已完成登录入口、昵称/文字头像、图片入口降级。

M10.3 已完成每用户存储额度与空间提示。

M10.4 已完成管理员最小用户管理：用户列表、禁用/启用、调额度、重置密码。

现在可以进入注册能力，但不能直接开放公网自由注册。当前服务器资源有限，且产品还没有内容审核、邮件验证、风控系统，因此 M10.5 只做：

```text
邀请制注册
```

也就是管理员先生成邀请码，用户拿邀请码注册账号。

## 2. 产品决策

### 2.1 不开放自由注册

本轮不做“任何人都能注册”。

原因：

1. 当前服务器资源有限。
2. 图片和附件虽然已有额度限制，但仍需要控制用户来源。
3. 内容治理和滥用处理还未做。
4. 邀请制足够支撑小范围试用。

### 2.2 正式登录身份改为邮箱

M10.5 新注册用户使用：

```text
email + password
```

当前老账号 `admin` 仍可继续使用 `username + password`，不强制迁移。

新用户注册后：

```text
email = 登录邮箱
username = 可由 email 自动生成的兼容字段，或直接存 email
displayName = email @ 前缀
```

产品口径：

1. `User.id` 是系统内部 ID，用户不可设置。
2. `email` 是登录和联系方式。
3. `displayName` 是昵称。
4. 不要把邮箱完整当昵称显示，默认取邮箱 `@` 前缀。

### 2.3 邀请码控制入口

只有管理员可以创建邀请码。

邀请码默认：

```text
单次使用
7 天有效
默认新用户额度 10 MB
默认角色 user
默认状态 active
```

## 3. 本轮目标

M10.5 做五件事：

1. User 增加 email 字段，支持新用户邮箱登录。
2. 新增邀请码数据模型。
3. 管理员可生成/查看/作废邀请码。
4. 用户可通过邀请码注册。
5. 登录页增加“使用邀请码注册”入口。

## 4. 本轮不做

明确不做：

1. 不做公开注册。
2. 不做邮箱验证码。
3. 不做邮件找回密码。
4. 不做微信登录。
5. 不做手机号登录。
6. 不做第三方 OAuth。
7. 不做内容审核。
8. 不做删除用户。
9. 不做复杂组织/团队。
10. 不做付费套餐。

忘记密码放到 M10.6。

## 5. 数据模型

### 5.1 User 扩展

在 `User` 上增加：

```prisma
model User {
  email String? @unique
}
```

要求：

1. `email` 可空，兼容现有 `admin` 账号。
2. 新注册用户必须有 email。
3. email 入库前必须小写归一化、trim。
4. email 唯一。
5. 不要用 email 替代 `User.id`。

当前 `username` 兼容策略：

```text
老用户：继续使用现有 username。
新用户：username 可自动设为 email，或 email 前缀 + 短随机后缀，技术部二选一但必须保证唯一。
```

推荐简单方案：

```text
新用户 username = email
```

后续如果要单独账号名，再做迁移。

### 5.2 InviteCode 模型

新增：

```prisma
model InviteCode {
  id          String    @id @default(cuid())
  codeHash    String    @unique
  createdById String
  usedById    String?
  status      String    @default("active")
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  createdBy User @relation("InviteCreatedBy", fields: [createdById], references: [id])
  usedBy    User? @relation("InviteUsedBy", fields: [usedById], references: [id])
}
```

字段口径：

```text
status: active / revoked / used / expired
```

安全要求：

1. 数据库不要明文保存邀请码。
2. 只保存 `codeHash`。
3. 生成时只把明文邀请码返回给管理员一次。
4. 后续列表只显示创建时间、过期时间、状态、是否使用，不显示完整明文。

如果技术部认为 hash 实现超出本轮，也可以短期保存 code，但必须在交付报告里标为安全债。产品建议直接做 hash。

## 6. 邀请码规则

### 6.1 生成规则

邀请码建议：

```text
长度：16-24 字符
字符集：大写字母 + 数字，去掉易混字符 O/0/I/1
示例：PN-8K7Q-M4ZR-W2XA
```

要求：

1. 不可预测。
2. 不可重复。
3. 默认 7 天有效。
4. 默认单次使用。
5. 管理员可作废未使用的邀请码。

### 6.2 使用规则

注册时校验：

1. 邀请码存在。
2. 邀请码未作废。
3. 邀请码未使用。
4. 邀请码未过期。
5. email 未被注册。
6. password 合规。

使用成功后：

```text
InviteCode.status = used
InviteCode.usedById = 新用户 id
InviteCode.usedAt = now
```

必须在事务中完成：

```text
校验邀请码 -> 创建用户 -> 标记邀请码已使用
```

避免并发下一个邀请码被用两次。

## 7. API 设计

### 7.1 管理员生成邀请码

```text
POST /api/admin/invites
```

仅 admin。

请求可选：

```json
{
  "expiresInDays": 7
}
```

返回：

```json
{
  "ok": true,
  "invite": {
    "id": "xxx",
    "code": "PN-8K7Q-M4ZR-W2XA",
    "expiresAt": "..."
  }
}
```

注意：

```text
code 明文只在创建时返回一次。
```

### 7.2 管理员查看邀请码列表

```text
GET /api/admin/invites
```

仅 admin。

返回：

```json
{
  "ok": true,
  "invites": [
    {
      "id": "xxx",
      "status": "active",
      "expiresAt": "...",
      "usedAt": null,
      "usedBy": null,
      "createdAt": "..."
    }
  ]
}
```

不要返回完整明文 code。

### 7.3 管理员作废邀请码

```text
PATCH /api/admin/invites/:id/revoke
```

仅 admin。

要求：

1. 只能作废 active 且未使用的邀请码。
2. used 邀请码不能作废。
3. expired 邀请码无需作废。

### 7.4 注册接口

```text
POST /api/auth/register
```

请求：

```json
{
  "email": "user@example.com",
  "password": "password123",
  "inviteCode": "PN-8K7Q-M4ZR-W2XA"
}
```

成功后：

```json
{
  "ok": true,
  "user": {
    "id": "xxx",
    "email": "user@example.com",
    "username": "user@example.com",
    "displayName": "user",
    "role": "user",
    "status": "active",
    "storageQuotaBytes": 10485760,
    "storageUsedBytes": 0
  }
}
```

建议注册成功后自动登录，减少用户步骤。

## 8. 校验与错误码

### 8.1 email 校验

要求：

1. trim。
2. 小写。
3. 基础 email 格式校验。
4. 唯一。

错误码：

```text
INVALID_EMAIL
EMAIL_ALREADY_REGISTERED
```

### 8.2 密码校验

要求：

1. 最少 8 位。
2. 不允许空。
3. 本轮可先不强制复杂度，但建议前端提示“建议包含字母和数字”。

错误码：

```text
PASSWORD_TOO_SHORT
```

### 8.3 邀请码错误

错误码：

```text
INVALID_INVITE_CODE
INVITE_REVOKED
INVITE_USED
INVITE_EXPIRED
```

前端统一友好提示：

```text
邀请码无效或已过期
```

不要过度暴露邀请码状态给非管理员。API 可以有细分错误码，前端展示可收敛。

## 9. UI 设计

### 9.1 管理员入口

在 `/admin/users` 页面增加一个轻量区域：

```text
邀请码
生成邀请码
邀请码列表
作废
```

也可以做独立页面：

```text
/admin/invites
```

产品建议：

```text
本轮放在 /admin/users 同页即可，减少后台复杂度。
```

### 9.2 生成邀请码 UI

点击“生成邀请码”后：

1. 显示明文邀请码。
2. 提示“只显示一次，请复制保存”。
3. 显示过期时间。

文案：

```text
邀请码只显示一次，请现在复制给用户。
```

### 9.3 注册页

登录页增加：

```text
使用邀请码注册
```

注册表单字段：

```text
邮箱
密码
确认密码
邀请码
```

要求：

1. 两次密码不一致不能提交。
2. 注册成功后自动登录并进入首页。
3. 已登录用户访问注册页应回首页。
4. 注册页视觉延续 M9/M10 登录页风格。

## 10. 安全要求

1. 邀请码必须有足够随机性。
2. 邀请码不要明文长期存库。
3. password 必须 bcrypt hash。
4. 注册接口不能创建 admin。
5. 注册接口不能自定义额度。
6. 注册接口不能设置 role/status。
7. 新用户默认 `role=user`、`status=active`、`quota=10MB`。
8. 管理员 API 不返回 passwordHash。
9. 注册失败不要泄露敏感内部信息。

## 11. 数据安全执行顺序

生产执行顺序：

1. 备份生产数据库。
2. 记录 User / Note / Attachment / InviteCode 数量。
3. `PRAGMA integrity_check = ok`。
4. 部署 schema。
5. `prisma db push`。
6. build。
7. 重启服务。
8. 健康检查。
9. 管理员生成邀请码测试。
10. 邀请码注册测试。
11. 清理测试用户和测试邀请码。

## 12. 验收标准

### 12.1 数据验收

必须提供：

```text
User: 前 -> 后
Note: 前 -> 后
Attachment: 前 -> 后
InviteCode: 前 -> 后
```

通过标准：

1. 现有 admin 不受影响。
2. 历史 Note / Attachment 不变。
3. 新用户注册后拥有独立 userId。
4. 新用户 storageQuotaBytes = 10MB。
5. 新用户 storageUsedBytes = 0。

### 12.2 管理员邀请码验收

必须通过：

1. admin 能生成邀请码。
2. 生成后明文只在当次返回/显示。
3. 邀请码列表不显示完整明文。
4. admin 能作废未使用的邀请码。
5. 作废的邀请码不能注册。
6. 普通用户不能访问邀请码 API。
7. 未登录不能访问邀请码 API。

### 12.3 注册验收

必须通过：

1. 有效邀请码 + 新 email + 合法密码注册成功。
2. 注册成功后自动登录。
3. 新用户登录后看不到 admin 便签。
4. 新用户能新建自己的便签。
5. 新用户账号菜单显示 0 / 10MB。
6. 同一个邀请码不能二次使用。
7. 已注册 email 不能重复注册。
8. 过期/作废/错误邀请码不能注册。
9. 短密码被拒绝。
10. 密码确认不一致前端不能提交。

### 12.4 管理员列表联动验收

必须通过：

1. 新注册用户出现在 `/admin/users`。
2. 显示 email / username / displayName。
3. 管理员可禁用该用户。
4. 管理员可调整该用户额度。
5. 管理员可重置该用户密码。

## 13. 回归验收

必须复测：

1. admin 登录。
2. admin 历史便签仍可见。
3. 普通便签新建/编辑/保存。
4. 待办新建/编辑/保存。
5. 图片上传额度仍生效。
6. 账号菜单空间提示仍显示。
7. 管理员禁用/调额度/重置密码仍可用。
8. 断网防丢保护不退化。

## 14. 不通过标准

出现以下任一情况不能通过：

1. 任何人无需邀请码即可注册。
2. 邀请码可重复使用。
3. 邀请码明文长期存库或列表完整显示。
4. 注册用户能看到 admin 便签。
5. 注册用户能指定 role/admin/status/quota。
6. 注册破坏 admin 登录。
7. API 返回 passwordHash。
8. 本轮混入邮件找回、公开注册、微信登录等非本轮范围。

## 15. 交付物要求

技术部交付时必须提供：

1. 改动文件清单。
2. schema 变更说明。
3. 生产数据库备份路径。
4. `db push` 结果。
5. User / Note / Attachment / InviteCode 数量前后对比。
6. 邀请码生成/列表/作废验收结果。
7. 注册成功/失败验收结果。
8. 新用户数据隔离验收结果。
9. 管理员列表联动验收结果。
10. 回归测试结果。
11. 回退方案。

## 16. 回退方案

若出现注册破坏登录、数据隔离异常、admin 无法登录：

```text
停服务
恢复 M10.5 前数据库备份
回退 M10.5 代码
重新 build
重启服务
复查 admin 登录和历史便签
```

回退后确认：

1. admin 可登录。
2. Note 数量恢复。
3. Attachment 数量恢复。
4. M10.4 管理员功能仍可用。
5. M10.3 存储额度仍可用。

## 17. 后续路线

M10.5 完成后，再做：

```text
M10.6 忘记密码：邮件重置或管理员辅助重置升级
```

公开注册必须等内容治理、风控和服务器容量评估后再决定，不进入 M10。
