# 联调方式与 dev 后门

> 不依赖 MySQL、不依赖微信 AppID，前后端登录闭环能在本地一键跑通。

## dev 后门原理

后端 `lib/devtool.ts` 封装了 `resolveCode(code)`：

| 环境 | 行为 |
|---|---|
| dev（`NODE_ENV !== production` 且 `DEV_AUTO_LOGIN !== 'false'`） | **跳过微信 code2Session**，直接返回 mock openid `dev-mock-openid-123456` |
| 生产（`NODE_ENV=production`） | 走真实 `code2Session`，后门代码路径完全不执行 |

`auth.service` 只调 `resolveCode(code)`，不感知环境。启动时若后门开启，会打印醒目警告：
```
[dev] 已开启后门：登录时 POST /api/v1/auth/login 无需真实 code（生产环境自动关闭）
```

### 安全边界
- `config.dev.autoLogin` 在 `NODE_ENV=production` 时**恒为 false**（硬编码在 config）
- mock 行为全部被 `isDevAutoLogin()` 守卫，生产代码路径里无任何 mock 分支
- 想在本地测真实微信登录：`.env` 加 `DEV_AUTO_LOGIN=false`

---

## 三种联调方式

### 方式 1：纯后端验证（curl，零外部依赖）

```bash
cd packages/server
# 1. 起本地 MySQL 并建库（首次）
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS promise_checkin DEFAULT CHARACTER SET utf8mb4;"
# 2. 建表 + 种子用户
pnpm db:migrate
pnpm db:seed
# 3. 启动
pnpm dev

# 另开终端，测登录闭环
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"code":"any"}'
# → 返回 accessToken + user（dev 后门忽略 code）

TOKEN="<上面返回的 accessToken>"
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
# → 返回用户信息
```

### 方式 2：微信开发者工具（最接近真实）

```bash
cd packages/miniapp
pnpm dev:mp-weixin   # 编译到 dist/dev/mp-weixin
```
打开**微信开发者工具** → 导入 `packages/miniapp/dist/dev/mp-weixin` → 点"微信一键登录"。

- `wx.login` 会返回测试 code（开发者工具自带），后端 dev 后门忽略它
- **不需要在微信公众平台配 AppID**，开发者工具用测试号即可
- 若想测真实微信：miniapp 的 `env/.env` 填 `WX_APPID`，server 的 `.env` 填 `WX_APPID`/`WX_SECRET`

### 方式 3：H5 浏览器（最快看 UI）

```bash
cd packages/miniapp
pnpm dev:h5    # 浏览器访问提示的 localhost 端口
```
- `uni.login` 在 H5 下可能失败，前端已容错（传占位 code `'dev'`）
- 后端 dev 后门兜底，登录正常走通
- 注意：H5 下部分 uni API（如 `getUserProfile`）行为不同，UI 预览为主

---

## 线上切换

部署生产时，dev 后门**自动关闭**，无需改任何代码：
1. server 的 `.env` 设 `NODE_ENV=production`
2. 填真实 `WX_APPID` / `WX_SECRET`
3. 此时 `resolveCode` 走真实微信 `code2Session`

---

## 常见联调卡点

| 现象 | 原因 | 解决 |
|---|---|---|
| 登录返回 5000 "Authentication failed against database" | MySQL 未起或账号不对 | 起本地 MySQL，`.env` 的 `DATABASE_URL` 改对 |
| 登录返回 5000 "微信小程序配置缺失" | dev 后门未开启（`NODE_ENV=production`） | 本地开发确保 `.env` 不设 `NODE_ENV=production` |
| 登录返回 2001 "code Required" | 请求体没带 code | 前端已容错传 `'dev'`；curl 测试时 body 带 `{"code":"any"}` |
| 小程序点登录无反应 | `VITE_SERVER_BASEURL` 指向错误 | miniapp 的 `env/.env` 改成 `http://localhost:3000/api/v1` |
| `/health` 返回 `deps.db:false` | MySQL 未连接 | 同第一行 |
| 前端 H5 跨域报错 | 后端 CORS 未放行 | dev 环境 `CORS_ORIGIN=*`（已默认） |

---

## 相关文件

| 文件 | 职责 |
|---|---|
| `packages/server/src/lib/devtool.ts` | dev 后门核心（`resolveCode` / `isDevAutoLogin`） |
| `packages/server/src/config/index.ts` | `dev.autoLogin` 开关 |
| `packages/server/src/modules/auth/auth.service.ts` | 调 `resolveCode`（唯一接入点） |
| `packages/server/prisma/seed.ts` | 种子 dev 用户 |
| `packages/miniapp/src/store/user.ts` | 前端 wx.login 容错（传占位 code） |
