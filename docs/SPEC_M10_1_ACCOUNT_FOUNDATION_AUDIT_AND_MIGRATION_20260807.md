# PinNote M10.1 账号地基：默认用户、历史数据归属与隔离审计

日期：2026-08-07

## 1. 背景

PinNote 后续会逐步进入多用户账号体系，但不能一次性把登录、注册、昵称、头像、存储额度、管理员后台、内容审核全部丢进同一轮。账号系统真正的第一步不是做 UI，而是保证数据不会丢、不会串、能回退。

当前代码里已经存在一部分账号地基：

```text
User
Note.userId
Attachment.userId
iron-session
/api/auth/login
/api/auth/me
/api/auth/logout
```

所以 M10.1 不定义为“从零新增账号系统”，而是：

```text
审计并加固现有账号地基，确保历史数据全部归属默认用户，所有读写都按 userId 隔离。
```

这轮做完后，用户体验可以基本不变。不要在 M10.1 里做完整账号产品。

## 2. 本轮只做两件事

### 2.1 第一件事：历史数据安全归属

目标：

```text
把当前无明确账号时期产生的所有历史 Note / Attachment，确认或迁移到一个默认用户下面。
```

默认用户建议：

```text
username: local-owner
displayName: 当前用户（后续 M10.3 再做）
role: admin（后续再加 role 字段）
status: active（后续再加 status 字段）
```

如果当前数据库已经有 `admin` 用户，也可以继续沿用，但必须确认：

1. User 表中有且只有一个本阶段默认使用的用户。
2. 所有历史 Note 都有这个用户的 `userId`。
3. 所有历史 Attachment 都有这个用户的 `userId`。
4. 不存在 `userId` 为空、无效、指向不存在用户的数据。

### 2.2 第二件事：API 数据隔离审计

目标：

```text
所有便签和附件的读、写、删、恢复、归档、复制、文件访问，都必须按当前 session.userId 过滤。
```

也就是不能只按资源 id 操作：

```text
where: { id: noteId }
```

必须保证当前用户参与过滤：

```text
where: { id: noteId, userId: session.userId }
```

附件也一样：

```text
where: { id: attachmentId, userId: session.userId }
```

## 3. 本轮不做

M10.1 明确不做：

1. 不做邮箱注册。
2. 不做开放注册。
3. 不做微信登录。
4. 不做昵称编辑。
5. 不做头像上传。
6. 不做存储额度 UI。
7. 不做管理员后台。
8. 不做内容审核。
9. 不重做视觉。
10. 不改变现有便签编辑体验。

后续拆分建议：

```text
M10.2 邮箱/用户名 + 密码登录体验
M10.3 昵称 + 文字头像
M10.4 每用户存储额度
M10.5 管理员禁用用户 / 调整额度
M10.6 开放注册或邀请码
```

## 4. 数据安全执行顺序

技术部实施必须按下面顺序做，不能先改 API 再处理历史数据。

### 4.1 部署前备份

生产库迁移前必须备份。

要求：

1. 复制当前生产 SQLite 数据库。
2. 备份文件带时间戳。
3. 校验备份是合法 SQLite。
4. 执行 `PRAGMA integrity_check`，结果必须为 `ok`。
5. 记录迁移前表数量。

需要记录：

```text
User count
Note count
Attachment count
Note with null/invalid userId count
Attachment with null/invalid userId count
```

### 4.2 默认用户确认

确认默认用户是否存在。

如果没有默认用户，创建一个。

建议：

```text
username = local-owner
password = 由部署环境变量或临时强密码生成，不要写死在代码里
```

如果沿用已有 `admin` 用户，也可以，但交付报告必须写清楚：

```text
默认用户 id
默认用户名
历史数据归属到哪个用户
```

### 4.3 历史 Note 归属

检查：

```text
所有 Note.userId 是否非空
所有 Note.userId 是否能关联到 User.id
```

如果有未归属数据：

```text
全部迁移到默认用户 userId
```

迁移后必须验证：

```text
迁移前 Note 总数 = 迁移后 Note 总数
未归属 Note = 0
无效 userId Note = 0
```

### 4.4 历史 Attachment 归属

检查：

```text
所有 Attachment.userId 是否非空
所有 Attachment.userId 是否能关联到 User.id
所有 Attachment.noteId 是否能关联到 Note.id
Attachment.userId 是否与对应 Note.userId 一致
```

如果有不一致：

```text
以 Note.userId 为准修正 Attachment.userId
```

迁移后必须验证：

```text
迁移前 Attachment 总数 = 迁移后 Attachment 总数
未归属 Attachment = 0
无效 userId Attachment = 0
Attachment.userId 与 Note.userId 不一致数量 = 0
```

## 5. API 审计范围

至少审计以下接口：

```text
GET    /api/notes
POST   /api/notes
GET    /api/notes/trash
PATCH  /api/notes/:id
DELETE /api/notes/:id
POST   /api/notes/:id/restore
DELETE /api/notes/:id/permanent
POST   /api/notes/:id/duplicate
POST   /api/notes/:id/attachments
DELETE /api/notes/:id/attachments/:attachmentId
GET    /api/files/*
POST   /api/trash-cleanup
```

要求：

1. 无 session/userId 时返回 401。
2. 查询列表只返回当前用户数据。
3. 修改便签前必须确认便签属于当前用户。
4. 删除便签前必须确认便签属于当前用户。
5. 恢复/永久删除/复制都必须确认归属。
6. 附件上传必须确认 note 属于当前用户。
7. 附件删除必须同时校验 noteId、attachmentId、userId。
8. 文件访问必须校验 attachment.userId。
9. 清理回收站不能跨用户误删，必须按用户或确认系统任务安全边界。

## 6. 重点风险

### 6.1 最大风险：历史数据看不见

如果 API 改成按 `userId` 过滤，但历史 Note 没有正确挂到默认用户，页面会变成“数据丢了”的假象。

实际数据可能还在数据库里，但用户看不见。这也不能接受。

必须先迁移历史数据，再启用更严格过滤。

### 6.2 第二风险：附件串数据

附件比便签更容易漏。

必须同时检查：

```text
Attachment.userId
Attachment.noteId
文件路径访问权限
```

不能只检查 noteId。

### 6.3 第三风险：永久删除误删

永久删除和回收站清理必须特别小心。

要求：

1. 先查 note 是否属于当前用户。
2. 再删该 note 下的附件。
3. 再删 note。
4. 不允许只按 noteId 直接 deleteMany 附件，除非前面已经确认 note 归属。

## 7. 验收标准

### 7.1 数据验收

必须提供迁移前后数量：

```text
User: x -> y
Note: x -> x
Attachment: x -> x
未归属 Note: n -> 0
未归属 Attachment: n -> 0
无效 userId Note: n -> 0
无效 userId Attachment: n -> 0
Attachment.userId 与 Note.userId 不一致: n -> 0
```

通过标准：

1. 便签数量不减少。
2. 附件数量不减少。
3. 历史便签全部属于默认用户。
4. 历史附件全部属于默认用户或对应 note 的用户。
5. 页面打开后旧便签全部还在。
6. 旧图片附件仍能打开。

### 7.2 功能验收

必须复测：

1. 打开首页，旧便签列表还在。
2. 打开旧便签，标题/正文/待办还在。
3. 编辑旧便签并保存。
4. 新建普通便签。
5. 新建待办便签。
6. 搜索旧便签。
7. 归档/恢复。
8. 删除到回收站/恢复。
9. 永久删除测试便签。
10. 有图片的便签附件可查看。
11. 新上传图片归属当前用户。
12. 断网防丢保护不退化。

### 7.3 隔离验收

即使当前只有默认用户，也要做最小隔离测试。

建议临时创建第二个测试用户：

```text
username: isolation-test
```

测试：

1. 第二用户登录后看不到默认用户便签。
2. 第二用户不能通过 API id 读取默认用户便签。
3. 第二用户不能 PATCH 默认用户便签。
4. 第二用户不能删除默认用户附件。
5. 第二用户不能访问默认用户附件文件。

测试完可以删除第二用户及其测试数据。

## 8. 回退方案

必须提前准备回退。

触发回退：

1. 页面旧便签消失。
2. 附件打不开。
3. Note/Attachment 数量减少。
4. 出现跨用户读写。
5. 保存、防丢、删除、恢复出现阻塞级问题。

回退方式：

```text
停服务
恢复迁移前数据库备份
回退本轮代码
重新 build
重启服务
复查旧数据
```

交付报告必须写清楚备份文件路径和恢复命令。

## 9. 交付物要求

技术部本轮交付必须包含：

1. 改动文件清单。
2. 数据库 schema 是否变更。
3. 默认用户 id / username。
4. 迁移前后数量对比。
5. `PRAGMA integrity_check` 结果。
6. API userId 过滤审计清单。
7. 隔离测试结果。
8. 功能回归结果。
9. 备份文件路径。
10. 回退命令。

## 10. 产品确认口径

M10.1 只确认账号地基：

```text
历史数据不会丢。
历史数据都归属默认用户。
API 已按 userId 做数据隔离。
现有使用体验不变。
```

M10.1 不确认完整账号体验：

```text
不确认注册。
不确认昵称。
不确认头像。
不确认存储额度。
不确认管理员后台。
```

本轮宁可小，也要稳。
