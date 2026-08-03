# 全平台便签 Web MVP

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 数据库 | SQLite via Prisma ORM |
| 认证 | iron-session（HTTP-only Cookie） |
| 样式 | TailwindCSS |
| 图片处理 | sharp |

## 环境要求

- Node.js >= 18
- npm >= 9

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，修改 SESSION_SECRET 为随机字符串

# 3. 初始化数据库并创建管理员账号
npm run setup

# 4. 启动开发服务器
npm run dev

# 5. 浏览器打开 http://localhost:3000
# 默认管理员：admin / admin123
```

## 生产部署

```bash
# 1. 构建
npm run build

# 2. 配置生产环境变量
export DATABASE_URL="file:./prod.db"
export SESSION_SECRET="<随机32字符以上密钥>"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="<强密码>"
export UPLOAD_DIR="/var/data/notes/uploads"   # 图片上传目录，必须指向持久化路径
export MAX_IMAGE_SIZE_MB=5                     # 单张图片大小上限（默认 5MB）
export MAX_IMAGES_PER_NOTE=12                  # 每条便签图片数量上限（默认 12）

# 3. 初始化数据库
npm run setup

# 4. 创建上传目录（如果不存在）
mkdir -p /var/data/notes/uploads

# 5. 启动
npm start

# 建议使用 PM2 或类似工具管理进程：
# npm install -g pm2
# pm2 start npm --name "notes" -- start
```

### 上传目录说明

- 图片文件存储在 `UPLOAD_DIR/notes/{noteId}/` 下，文件名由系统生成，不暴露原始文件名。
- 文件访问经过 API 鉴权（`/api/files/*`），需登录才能访问。
- **生产环境必须将上传目录挂载到持久化磁盘**，并纳入定期备份。
- 删除便签进入回收站时，图片文件保留；恢复便签后图片仍可用。
- 永久删除便签时，系统自动清理该便签的所有图片文件及数据库记录。
- 如果文件因磁盘故障等原因已不存在，删除附件接口仍返回成功。

### Nginx 反代配置示例

```nginx
server {
    listen 443 ssl;
    server_name notes.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 上传大小限制（需大于 MAX_IMAGE_SIZE_MB）
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run db:push      # 同步数据库 schema
npm run db:seed      # 重新执行种子脚本
npm run db:studio    # 打开 Prisma Studio
npm run setup        # 初始化数据库 + 种子
```

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── globals.css             # 全局样式
│   ├── login/                  # 登录页
│   │   ├── page.tsx            #   - 服务端组件（认证检查）
│   │   └── LoginForm.tsx       #   - 登录表单客户端组件
│   ├── (protected)/            # 需登录的路由组
│   │   ├── layout.tsx          #   - 认证守卫布局
│   │   ├── page.tsx            #   - 主页（列表+编辑）
│   │   ├── archive/page.tsx    #   - 归档页
│   │   └── trash/page.tsx      #   - 回收站页
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts  # POST 登录
│       │   ├── logout/route.ts # POST 登出
│       │   └── me/route.ts     # GET 当前用户
│       ├── notes/
│       │   ├── route.ts        # GET 列表 / POST 创建
│       │   ├── [id]/
│       │   │   ├── route.ts    # PATCH 更新 / DELETE 删除
│       │   │   ├── attachments/route.ts        # POST 上传图片
│       │   │   ├── attachments/[attachmentId]/route.ts  # DELETE 删除图片
│       │   │   ├── permanent/route.ts          # DELETE 永久删除
│       │   │   └── restore/route.ts            # POST 恢复
│       │   └── trash/route.ts  # GET 回收站列表
│       └── files/[...path]/route.ts  # GET 鉴权文件访问
├── components/
│   ├── TopBar.tsx              # 顶部导航栏
│   ├── NoteList.tsx            # 便签列表
│   ├── NoteEditor.tsx          # 便签编辑器（含自动保存）
│   ├── ChecklistEditor.tsx     # 待办清单编辑器
│   ├── ImageAttachments.tsx    # 图片附件上传、缩略图、删除
│   ├── ImagePreview.tsx        # 图片预览弹层
│   ├── ColorPicker.tsx         # 颜色选择器
│   └── SaveStatus.tsx          # 保存状态指示器
├── hooks/
│   └── useNotes.ts             # 便签数据管理 Hook
├── lib/
│   ├── prisma.ts               # Prisma 客户端单例
│   ├── session.ts              # iron-session 配置
│   ├── auth.ts                 # 认证辅助函数
│   └── note-serializer.ts      # 便签序列化（含 checklistItems、attachments）
└── types/
    └── index.ts                # 共享类型定义
prisma/
├── schema.prisma               # 数据模型
└── seed.ts                     # 管理员账号初始化
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户 |
| GET | /api/notes?archived=&q= | 便签列表（搜索、归档筛选） |
| POST | /api/notes | 新建便签 |
| PATCH | /api/notes/:id | 更新便签 |
| DELETE | /api/notes/:id | 删除便签（进入回收站） |
| POST | /api/notes/:id/restore | 从回收站恢复 |
| DELETE | /api/notes/:id/permanent | 永久删除 |
| GET | /api/notes/trash?q= | 回收站列表 |
| POST | /api/notes/:id/attachments | 上传图片（multipart/form-data） |
| DELETE | /api/notes/:id/attachments/:attachmentId | 删除图片 |
| GET | /api/files/* | 鉴权图片访问 |

## 默认账号

用户名：`admin`
密码：`admin123`

⚠️ **生产环境务必修改密码。**

---

## Windows 桌面壳（M7）

桌面壳用 Tauri 2 实现，加载线上 Web 版便签，提供主窗口 + 悬浮便签窗口 + 置顶能力。Web 端更新后，桌面壳自动获得新功能。

代码在 `src-tauri/` 目录。

### 环境要求

- Node.js >= 18
- Rust（构建桌面壳需要）：https://rustup.rs

### 如何启动（开发）

```bash
npm install
npm run tauri dev
```

自动启动 Web 开发服务器并打开桌面窗口，开发环境加载 `http://localhost:3000`。

### 如何构建 Windows 安装包

Mac 上无法直接产出 Windows 安装包，两种方式：

1. **GitHub Actions（推荐）**：推送到 GitHub 仓库后，`.github/workflows/build-windows.yml` 自动在 Windows runner 构建，安装包出现在 Release 草稿页。
2. **Windows 机器本地构建**：

   ```bash
   npm ci
   npm run tauri build
   ```

   产物在 `src-tauri/target/release/bundle/`（NSIS `.exe` 安装包 + `.msi`）。

### 如何切换开发/生产地址

- 开发（`tauri dev`）：加载 `http://localhost:3000`
- 生产（`tauri build`）：加载 `https://notes.hello-mylife.online`

地址在 `src-tauri/src/lib.rs` 的 `PROD_URL` / `DEV_URL` 常量中统一配置，生产包默认加载生产域名，不会误连本地开发地址。

### 如何打开悬浮窗口

1. 主窗口登录后，打开任意便签。
2. 工具栏点击「在悬浮窗中打开」（右上箭头窗口图标）。
3. 悬浮窗口只显示该便签，默认置顶。

### 如何开启/关闭置顶

- 悬浮窗口内点击**图钉**按钮切换窗口置顶（默认开启，状态会记忆并在下次打开时恢复）。
- 主窗口同样有图钉按钮，可手动切换主窗口置顶（默认关闭）。

### 登录态

登录后 cookie 保存在壳内 WebView 中，关闭再打开 App 无需重新登录。退出登录后壳内登录态清理干净。

### 安全

- 壳内仅允许加载 `https://notes.hello-mylife.online` 与 `http://localhost:3000`。
- 其他外部 URL 导航会被壳拦截，不会在壳内打开。
- 登录校验完全由 Web 端承担，壳不绕过鉴权、不在本地明文保存密码。
