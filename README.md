# 如约打卡 · promise-checkin

> 通用按计划打卡 + 缺席追溯工具。把"课程/服药/测量"抽象成「计划 + 打卡记录」，一套机制覆盖所有定时重复场景。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | uni-app (Vue3 + TS + Vite + Pinia) + wot-design-uni |
| 后端 | Koa2 + TypeScript + Prisma + MySQL 8 + Redis 7 |
| 共享 | `@promise-checkin/shared`（前后端类型/枚举/常量契约） |
| 工程 | pnpm monorepo + ESLint + Prettier + commitlint |

## 架构与解耦

详见 `docs/` 下设计文档。核心解耦原则：

- **shared 是契约**：任何 DTO/枚举改动必须在 shared 改，前后端引用同一类型
- **后端三层**：Controller（路由+校验）→ Service（业务逻辑+事务）→ Repository（Prisma 数据访问），依赖单向
- **前端分层**：API（发请求）→ Store（状态）→ 页面（渲染），HTTP/路由/token 复用封装

```
packages/
├── shared/    类型、枚举、常量（前后端共享）
├── server/    后端 Koa2（modules/{auth,plan,checkin,stats} 各自三层）
└── miniapp/   前端 uni-app（pages/store/api/http/router）
```

## 本地启动

### 前置依赖

- Node.js ≥ 20
- pnpm ≥ 11（`npm i -g pnpm`）
- MySQL 8 + Redis 7（后端依赖；M0 阶段 Redis 可选，MySQL 建库后才能登录）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动后端

```bash
# 准备数据库（首次）
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS promise_checkin DEFAULT CHARACTER SET utf8mb4;"
# 创建专用账号（参考 docs/06-部署与运维.md）

cd packages/server
cp .env .env.local  # 按需修改 DATABASE_URL / WX_APPID / WX_SECRET

pnpm db:migrate     # 建表（Prisma migration）
pnpm dev            # tsx 热重载，监听 http://localhost:3000
```

健康检查：`curl http://localhost:3000/health`

### 3. 启动前端

```bash
cd packages/miniapp
# 配置 env/.env（VITE_SERVER_BASEURL 指向后端，WX_APPID 填小程序 AppID）
pnpm dev:mp-weixin   # 编译到 dist/dev/mp-weixin
```

用**微信开发者工具**导入 `packages/miniapp/dist/dev/mp-weixin` 目录即可预览。

## 验证登录闭环（M0 验收）

1. 启动后端（`packages/server` → `pnpm dev`），确认 `/health` 返回 `deps.db: true`
2. 启动前端（`packages/miniapp` → `pnpm dev:mp-weixin`）
3. 微信开发者工具导入 `dist/dev/mp-weixin`
4. 填入真实 `WX_APPID` / `WX_SECRET`（`packages/server/.env`）和 `WX_APPID`（`packages/miniapp/env/.env`）
5. 小程序点"微信一键登录" → 成功后跳到「今日」页
6. 切到「我的」Tab → 应显示昵称 → 重启小程序仍保持登录态

## 已验证（自动化）

- ✅ 后端类型检查通过（`pnpm --filter server typecheck`）
- ✅ 后端启动 + 鉴权/校验/错误兜底 curl 验证通过
- ✅ shared 包类型检查通过
- ✅ 前端 mp-weixin 构建成功

## 开发进度

**M0 工程地基 + 登录闭环** — 脚手架与三层架构已就绪，登录接口全链路打通。

下一步（M1 MVP）：
- 后端：plan / checkin / stats 模块（三层）+ 排期生成定时任务 + 多口径计数
- 前端：今日打卡 / 计划列表 / 计划详情（进度环+日历）/ 分步表单

## 相关文档

- `docs/01-需求与产品定义.md` ~ `docs/07-开发路线图.md`：完整设计
- `demo/index.html`：可交互原型（数据存浏览器本地，验证建模用）

> 注：设计文档（03/04/05）部分内容滞后于 demo 和实现，以代码实现为准，文档将随后续迭代同步。
