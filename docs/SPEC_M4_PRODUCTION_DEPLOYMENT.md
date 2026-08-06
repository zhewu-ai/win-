# 全平台便签 M4 产品规格：上线部署与迭代准备

## 1. 本轮目标

M4 目标是把当前已通过 M3 验收的 Web 便签部署到现有腾讯云服务器，开放 HTTPS 域名访问，并建立后续线上迭代、备份、回滚和验收流程。

本轮仍然只做 Web 端上线，不做 Windows/Mac 壳，不做手机端原生 App。

## 2. 上线前置条件

上线前必须满足：

1. `npm run build` 通过。
2. M3 图片附件验收通过。
3. 图片文件访问路径穿越问题已修复并复测通过。
4. 生产环境管理员密码已更换。
5. `SESSION_SECRET` 已使用 32 字符以上随机值。
6. SQLite 数据库目录和图片上传目录均使用服务器持久化路径。
7. 部署方案明确不会影响 Hermes Health Assistant 现有服务。

若任一前置条件不满足，不允许公网切换。

## 3. 与 Hermes 项目的隔离边界

### 3.1 硬性禁止

技术部不得执行以下操作：

1. 不得把便签项目放入 `/home/ubuntu/hermes-health/`。
2. 不得修改 Hermes 的 systemd service。
3. 不得复用 Hermes 已占用端口。
4. 不得改动 Hermes 现有域名的 Caddy 配置块。
5. 不得复用 Hermes 的 `.env`、数据库、上传目录或日志目录。
6. 不得为便签项目开放公网裸端口。

### 3.2 当前已知 Hermes 端口

便签项目不能占用：

```text
Hermes Health Backend: 127.0.0.1:8000
Hermes Dashboard: 127.0.0.1:9119
```

### 3.3 便签推荐隔离配置

```text
项目名称：sticky-notes
项目目录：/home/ubuntu/projects/sticky-notes
监听地址：127.0.0.1:9002
服务名称：sticky-notes.service
访问域名：notes.hello-mylife.online
数据库路径：/home/ubuntu/projects/sticky-notes/data/prod.db
上传目录：/home/ubuntu/projects/sticky-notes/uploads
日志来源：journalctl --user -u sticky-notes.service
```

如 9002 已被占用，可改用 9003，但必须先检查并在交付报告中说明。

## 4. 推荐服务器目录结构

```text
/home/ubuntu/projects/sticky-notes/
  .env
  package.json
  package-lock.json
  next.config.mjs
  prisma/
  src/
  public/
  data/
    prod.db
  uploads/
    notes/
```

要求：

- `.env` 不进入 Git。
- `data/` 不进入 Git。
- `uploads/` 不进入 Git。
- `data/` 和 `uploads/` 必须纳入备份。
- 代码更新不得覆盖生产 `.env`、数据库和上传目录。

## 5. 生产环境变量

生产 `.env` 示例：

```env
DATABASE_URL="file:/home/ubuntu/projects/sticky-notes/data/prod.db"
SESSION_SECRET="<32字符以上随机值>"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<强密码>"
UPLOAD_DIR="/home/ubuntu/projects/sticky-notes/uploads"
MAX_IMAGE_SIZE_MB=5
MAX_IMAGES_PER_NOTE=12
PORT=9002
HOSTNAME="127.0.0.1"
```

要求：

- 不允许使用默认密码 `admin123`。
- 不允许把 `.env` 内容提交 Git。
- 不允许在群聊、文档或提交记录里暴露真实密码和密钥。
- `DATABASE_URL` 和 `UPLOAD_DIR` 必须使用绝对路径。

## 6. 部署流程

### 6.1 服务器准备

```bash
mkdir -p /home/ubuntu/projects/sticky-notes
mkdir -p /home/ubuntu/projects/sticky-notes/data
mkdir -p /home/ubuntu/projects/sticky-notes/uploads
```

### 6.2 上传或拉取代码

推荐 Git：

```bash
cd /home/ubuntu/projects
git clone <REPO_URL> sticky-notes
cd /home/ubuntu/projects/sticky-notes
```

如果使用 `rsync`，必须排除：

```text
.env
.next
node_modules
data
uploads
dev.db
*.db
```

### 6.3 安装、迁移、构建

```bash
cd /home/ubuntu/projects/sticky-notes
npm ci
npm run db:generate
npm run db:push
npm run build
```

如果是首次部署，需要执行种子脚本创建管理员账号：

```bash
npm run db:seed
```

### 6.4 本地启动验证

```bash
HOSTNAME=127.0.0.1 PORT=9002 npm start
```

另开终端验证：

```bash
curl -I http://127.0.0.1:9002
```

验证完成后停止手动启动，改用 systemd。

## 7. systemd 用户服务

服务文件：

```text
~/.config/systemd/user/sticky-notes.service
```

建议内容：

```ini
[Unit]
Description=Sticky Notes Web App
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/projects/sticky-notes
EnvironmentFile=/home/ubuntu/projects/sticky-notes/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

启动：

```bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user daemon-reload
systemctl --user enable --now sticky-notes.service
systemctl --user status sticky-notes.service --no-pager
```

如需 SSH 断开后继续运行：

```bash
sudo loginctl enable-linger ubuntu
```

日志：

```bash
journalctl --user -u sticky-notes.service -n 100 --no-pager
journalctl --user -u sticky-notes.service -f
```

## 8. Caddy 域名接入

### 8.1 DNS

新增 DNS A 记录：

```text
主机记录：notes
记录类型：A
记录值：服务器公网 IP
TTL：默认
```

### 8.2 Caddy 修改规则

修改 `/etc/caddy/Caddyfile` 前必须备份：

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M%S)
```

只允许追加便签项目自己的域名块，不允许重写 Hermes 现有域名块。

推荐配置：

```caddy
notes.hello-mylife.online {
    request_body {
        max_size 10MB
    }

    reverse_proxy 127.0.0.1:9002
}
```

如果决定增加 Caddy Basic Auth，必须使用哈希密码，不得写明文密码：

```caddy
notes.hello-mylife.online {
    basicauth {
        <username> <hashed_password>
    }

    request_body {
        max_size 10MB
    }

    reverse_proxy 127.0.0.1:9002
}
```

检查并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

## 9. 上线验收清单

### 9.1 服务和域名

1. `systemctl --user status sticky-notes.service --no-pager` 显示 `active (running)`。
2. `curl -I http://127.0.0.1:9002` 返回 200 或 307/308 到登录页。
3. `curl -I https://notes.hello-mylife.online` 返回 200、302、307、308 或 Basic Auth 下的 401。
4. `sudo systemctl status caddy --no-pager` 显示 `active (running)`。
5. `sudo journalctl -u caddy -n 100 --no-pager` 无新增错误。
6. `journalctl --user -u sticky-notes.service -n 100 --no-pager` 无启动错误。

### 9.2 Hermes 隔离验收

1. Hermes Backend 端口仍正常监听。
2. Hermes Dashboard 端口仍正常监听。
3. Hermes 原有域名仍可访问。
4. Caddyfile 中 Hermes 域名块未被改写。
5. 便签项目没有写入 `/home/ubuntu/hermes-health/`。

建议检查：

```bash
ss -ltnp | grep -E ':8000|:9002|:9119'
```

### 9.3 便签核心功能验收

用线上域名验证：

1. 登录成功。
2. 新建普通便签成功。
3. 自动保存成功，刷新后内容仍在。
4. 新建待办便签成功。
5. 勾选待办项后刷新状态仍在。
6. 上传 1 张图片成功。
7. 一次选择 3 张图片后，编辑区立即显示 3 张。
8. 点击图片可预览，可关闭。
9. 删除单张图片后刷新不再显示。
10. 删除便签进入回收站，回收站显示图片数量提示。
11. 从回收站恢复后图片仍可访问。
12. 永久删除便签后，图片文件和数据库附件记录被清理。

### 9.4 安全验收

必须验证：

1. 未登录访问 `/api/notes` 返回 401。
2. 未登录访问图片 URL 返回 401。
3. 非图片上传返回 400。
4. 超过 `MAX_IMAGE_SIZE_MB` 的图片上传返回 400。
5. 第 13 张图片上传返回 400。
6. 路径穿越请求返回 403 或 404。

路径穿越示例：

```bash
curl -i "https://notes.hello-mylife.online/api/files/%2e%2e%2fuploads_evil%2fleak.png"
```

不得返回 200。

### 9.5 移动端验收

在 390px 宽度或真实手机浏览器验证：

1. 登录页无横向滚动。
2. 首页列表无横向滚动。
3. 打开便签后只显示编辑区，不残留列表。
4. 返回列表后不残留编辑区。
5. 图片缩略图不溢出屏幕。
6. 图片预览层可关闭。

## 10. 备份要求

最小备份范围：

```text
/home/ubuntu/projects/sticky-notes/.env
/home/ubuntu/projects/sticky-notes/data/
/home/ubuntu/projects/sticky-notes/uploads/
```

建议备份频率：

```text
每天 1 次，至少保留最近 7 天。
```

技术部需给出实际备份方案，例如：

```text
本机 tar 定时备份
异机 rsync
对象存储归档
服务器快照
```

验收时至少提供一次手动备份结果：

```bash
tar -czf /home/ubuntu/backups/sticky-notes-$(date +%Y%m%d%H%M%S).tar.gz \
  /home/ubuntu/projects/sticky-notes/.env \
  /home/ubuntu/projects/sticky-notes/data \
  /home/ubuntu/projects/sticky-notes/uploads
```

注意：备份包包含敏感数据，不得公开上传或提交 Git。

## 11. 回滚方案

上线前必须记录当前版本：

```bash
git rev-parse HEAD
```

每次上线前备份：

```text
.env
data/
uploads/
Caddyfile
```

回滚步骤：

1. 停止便签服务。
2. 切回上一版本代码。
3. 执行 `npm ci` 和 `npm run build`。
4. 如数据库 schema 有变更，先评估是否可逆；不可逆时恢复备份。
5. 启动 `sticky-notes.service`。
6. 验证域名、登录、便签读取、图片读取。

命令示例：

```bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user stop sticky-notes.service
git checkout <LAST_GOOD_COMMIT>
npm ci
npm run build
systemctl --user start sticky-notes.service
systemctl --user status sticky-notes.service --no-pager
```

## 12. 技术部上线交付格式

部署完成后，技术部必须按以下格式回报：

```text
项目名称：
部署路径：
Git commit：
服务名称：
监听地址：
访问域名：
Caddy 配置摘要：
是否改动 Hermes 域名块：
Hermes Backend 是否正常：
Hermes Dashboard 是否正常：
DATABASE_URL：
UPLOAD_DIR：
图片上传大小限制：
单便签图片数量限制：
是否需要 Basic Auth：
健康检查结果：
systemd 状态：
Caddy 状态：
最近 100 行服务日志：
最近 100 行 Caddy 日志：
备份方案：
回滚方案：
剩余风险：
```

## 13. 本轮完成标准

M4 通过标准：

1. 线上域名可通过 HTTPS 访问。
2. 便签核心功能在线上域名通过验收。
3. 图片上传、访问、删除、恢复、永久清理在线上通过验收。
4. 未登录和路径穿越安全验收通过。
5. Hermes 现有服务不受影响。
6. systemd 自启和 Caddy reload 均通过。
7. 数据库与图片上传目录已有备份方案。
8. 技术部按标准格式提交部署报告。

未达到以上任一项，M4 不通过。
