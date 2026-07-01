# 04 - API 接口设计

> 项目：**如约打卡**（promise-checkin）
> 风格：RESTful · 鉴权：JWT Bearer · 数据格式：JSON
> Base URL：`https://<domain>/api/v1`
> 最后更新：2026-07-01（M2：新增数值趋势/回收站接口）

---

## 一、通用约定

### 1.1 请求头
```
Content-Type: application/json
Authorization: Bearer <accessToken>     ← 除登录外所有接口必需
X-Client: miniapp                        ← 客户端标识
```

### 1.2 统一响应格式
```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```
- `code = 0` 表示成功；非 0 表示业务错误。
- `message` 人类可读的提示（中文）。
- `data` 业务数据，可为对象、数组或 null。

### 1.3 错误码定义
| code | HTTP | 含义 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 401 | 未登录或 token 失效 |
| 1002 | 401 | token 已过期 |
| 1003 | 403 | 无权限访问该资源 |
| 2001 | 400 | 参数校验失败（data 含字段级错误） |
| 2002 | 404 | 资源不存在 |
| 2003 | 409 | 资源冲突（如重复打卡） |
| 3001 | 429 | 请求过于频繁（限流） |
| 5000 | 500 | 服务器内部错误 |
| 5001 | 503 | 服务暂不可用（维护中） |

### 1.4 分页约定
列表类接口统一用 query 参数：
- `page`：页码，从 1 开始，默认 1
- `pageSize`：每页条数，默认 20，最大 100

响应：
```json
{
  "code": 0,
  "data": {
    "list": [...],
    "total": 158,
    "page": 1,
    "pageSize": 20
  }
}
```

### 1.5 时间格式
- 日期：`YYYY-MM-DD`（如 `2026-06-22`）
- 时间：`HH:mm`（如 `18:00`）
- 完整时间：ISO 8601（如 `2026-06-22T18:00:00+08:00`）

---

## 二、接口清单总览

| 模块 | 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|---|
| 鉴权 | 微信登录 | POST | `/auth/login` | ❌ |
| 鉴权 | 刷新 token | POST | `/auth/refresh` | refresh |
| 鉴权 | 获取当前用户 | GET | `/auth/me` | ✅ |
| 计划 | 计划列表 | GET | `/plans` | ✅ |
| 计划 | 计划详情 | GET | `/plans/:id` | ✅ |
| 计划 | 新建计划 | POST | `/plans` | ✅ |
| 计划 | 更新计划 | PUT | `/plans/:id` | ✅ |
| 计划 | 删除计划 | DELETE | `/plans/:id` | ✅ |
| 计划 | 归档计划 | PATCH | `/plans/:id/archive` | ✅ |
| 计划 | 回收站列表 | GET | `/plans/trash` | ✅ |
| 计划 | 恢复计划 | PATCH | `/plans/:id/restore` | ✅ |
| 打卡 | 打卡记录列表 | GET | `/plans/:planId/checkins` | ✅ |
| 打卡 | 日历视图 | GET | `/plans/:planId/checkins/calendar` | ✅ |
| 打卡 | 创建/更新打卡（upsert） | POST | `/plans/:planId/checkins` | ✅ |
| 打卡 | 补录（事后补 done） | POST | `/plans/:planId/checkins/retroactive` | ✅ |
| 打卡 | 打卡详情 | GET | `/checkins/:id` | ✅ |
| 打卡 | 修改打卡状态 | PATCH | `/checkins/:id` | ✅ |
| 打卡 | 调整排期 | POST | `/checkins/:id/reschedule` | ✅ |
| 打卡 | 删除打卡 | DELETE | `/checkins/:id` | ✅ |
| 统计 | 首页概览 | GET | `/stats/overview` | ✅ |
| 统计 | 计划进度 | GET | `/plans/:id/progress` | ✅ |
| 统计 | 数值趋势 | GET | `/plans/:id/values` | ✅ |
| 统计 | 缺席列表 | GET | `/stats/missed` | ✅ |

---

## 三、鉴权模块

### 3.1 微信登录 `POST /auth/login`

**请求**
```json
{
  "code": "0a3xxxxxxx",       // wx.login() 拿到的 code
  "nickname": "张三",          // 可选，用户授权后的昵称
  "avatarUrl": "https://..."   // 可选，头像
}
```

**处理流程**
1. 后端拿 `code` 调微信 `code2Session` 接口换 `openid` + `session_key`。
2. 按 `openid` 查/建 `users` 记录。
3. 签发 accessToken（7天）+ refreshToken（30天）。

**响应**
```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 604800,
    "isNewUser": true,
    "user": {
      "id": 1,
      "openid": "oXXXX...",
      "nickname": "张三",
      "avatarUrl": "https://...",
      "phone": null,
      "status": 1,
      "lastLoginAt": "2026-06-30T10:00:00.000Z",
      "createdAt": "2026-06-30T10:00:00.000Z"
    }
  }
}
```
> `isNewUser` 在顶层（与 user 同级）。首次登录自动创建用户。

### 3.2 刷新 token `POST /auth/refresh`
**请求**：`{ "refreshToken": "..." }`
**响应**：同登录返回的 token 结构。

### 3.3 获取当前用户 `GET /auth/me`
**响应**：`{ "code": 0, "data": { ...user } }`，user 结构同登录响应里的 user。

> 注：`PUT /auth/profile`（更新用户资料）**M1 未实现**。当前用户资料在登录时由前端传 nickname/avatarUrl 顺带更新。独立资料编辑接口待后续迭代。

---

## 四、计划模块

### 4.1 计划列表 `GET /plans`

**Query 参数**
| 参数 | 类型 | 说明 |
|---|---|---|
| `type` | string | 可选，类型筛选（course/medicine/...） |
| `status` | string | 可选，状态筛选（active/archived/completed），默认 active |
| `keyword` | string | 可选，名称模糊搜索 |
| `page` / `pageSize` | number | 分页 |

**响应**
> Plan 对象的标准字段（列表/详情/新建/更新通用）：
> `id, userId, familyId, name, type, color, totalCount, initialDoneCount, doneCount, missedCount, absenceConsumes, timeMode, scheduleConfig, overdueHandling, overdueGraceHours, recordValue, valueUnit, startDate, endDate, status, remark, createdAt, updatedAt, deletedAt`
>
> 进度（consumed/remain/progress）不内嵌在 Plan 里，由独立的 `/plans/:id/progress` 接口提供。

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "userId": 1,
        "familyId": null,
        "name": "钢琴课",
        "type": "course",
        "color": "#AF52DE",
        "totalCount": 60,
        "initialDoneCount": 18,
        "doneCount": 11,
        "missedCount": 1,
        "absenceConsumes": false,
        "timeMode": "fixed",
        "scheduleConfig": { "rules": [{"weekday":2,"time":"18:00"},{"weekday":6,"time":"10:00"}] },
        "overdueHandling": "keep_pending",
        "overdueGraceHours": 24,
        "recordValue": false,
        "valueUnit": null,
        "startDate": "2026-05-19",
        "endDate": null,
        "status": "active",
        "remark": "周老师",
        "createdAt": "...",
        "updatedAt": "...",
        "deletedAt": null
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  }
}
```

### 4.2 计划详情 `GET /plans/:id`

**响应**：单个 Plan 对象（字段结构同 4.1 列表项，不再嵌套 stats）。
> 深度统计（streak/consumed/completionRate 等）请调 `/plans/:id/progress`。

### 4.3 新建计划 `POST /plans`

**请求**
```json
{
  "name": "钢琴课",
  "type": "course",
  "color": "#AF52DE",
  "totalCount": 60,
  "initialDoneCount": 18,
  "absenceConsumes": false,
  "timeMode": "fixed",
  "scheduleConfig": {
    "rules": [
      { "weekday": 2, "time": "18:00" },
      { "weekday": 6, "time": "10:00" }
    ]
  },
  "overdueHandling": "keep_pending",
  "overdueGraceHours": 24,
  "recordValue": false,
  "startDate": "2026-05-19",
  "remark": "周老师"
}
```

**响应**：返回创建好的 Plan 对象（字段同 4.1）。建计划时会自动生成未来 14 天的排期槽位。

**校验规则**
- `name` 非空，长度 1~64。
- `type` 必须是枚举值之一（course/medicine/measure/fitness/learning/custom）。
- `timeMode=fixed` 时 `scheduleConfig` 必填且 rules 非空。
- `totalCount` 为正整数 或 NULL（无限）。
- `initialDoneCount` 不能超过 `totalCount`。
- `timeMode=flexible` 时 `scheduleConfig` 应为 null。

### 4.4 更新计划 `PUT /plans/:id`
请求体同新建（部分字段可选）。`type` 创建后不可改（DTO 层强制 omit）。

### 4.5 删除计划 `DELETE /plans/:id`
软删除（写 `deleted_at`），事务内关联的 checkins 一并软删除。

### 4.6 归档计划 `PATCH /plans/:id/archive`
将 `status` 改为 `archived`，从列表隐藏，但数据保留。

---

## 五、打卡模块

> 打卡记录（Checkin）的标准字段（所有返回 checkin 的接口通用）：
> `id, planId, userId, memberId, scheduledDate, scheduledTime, status, actualTime, value, remark, source, adjustmentType, originalScheduledDate, originalScheduledTime, createdAt, updatedAt`

### 5.1 打卡记录列表 `GET /plans/:planId/checkins`

**Query 参数**
| 参数 | 类型 | 说明 |
|---|---|---|
| `startDate` | date | 起始日期 YYYY-MM-DD |
| `endDate` | date | 结束日期 |
| `status` | string | 状态筛选（done/missed/pending） |

**响应**：返回 Checkin 数组（M1 暂未分页，直接返回数组）
```json
{
  "code": 0,
  "data": [
    {
      "id": 50001,
      "planId": 2001,
      "userId": 1,
      "memberId": null,
      "scheduledDate": "2026-06-22",
      "scheduledTime": "18:00",
      "status": "done",
      "actualTime": "2026-06-22T18:03:00.000Z",
      "value": null,
      "remark": null,
      "source": "scheduled",
      "adjustmentType": null,
      "originalScheduledDate": null,
      "originalScheduledTime": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### 5.2 日历视图 `GET /plans/:planId/checkins/calendar`

**Query 参数**
| 参数 | 类型 | 说明 |
|---|---|---|
| `month` | string | 月份 `YYYY-MM`，默认当月 |

**响应**：返回该月所有打卡记录（完整 Checkin 对象数组，前端按 scheduledDate 聚合到日历格子）
```json
{
  "code": 0,
  "data": {
    "month": "2026-06",
    "days": [ /* Checkin 对象数组，同 5.1 的元素结构 */ ]
  }
}
```

### 5.3 创建/更新打卡 `POST /plans/:planId/checkins`

> upsert 语义：若该 `(scheduledDate, scheduledTime)` 槽位已有记录则更新状态，无则创建。

**请求**
```json
{
  "scheduledDate": "2026-06-22",
  "scheduledTime": "18:00",
  "status": "done",
  "value": 120,
  "remark": "按时上课"
}
```

**处理流程**
1. 校验 planId 属于当前用户（`assertOwnPlan`）。
2. 事务内 upsert checkin 记录。
3. 事务后调用 `syncPlanCounts`，全量重算 plan 的 `doneCount`/`missedCount`。

**响应**：返回更新后的单条 Checkin 对象（含 source/adjustmentType 等字段）。

### 5.4 补录 `POST /plans/:planId/checkins/retroactive`

> 事后补某天为已完成。用于"过去某天漏了，现在补上"。

**请求**
```json
{
  "scheduledDate": "2026-06-15",
  "scheduledTime": "18:00",   // 可选，固定排期时填
  "value": null,
  "remark": null
}
```

**处理逻辑**
- 若该槽位已有 `missed` 记录 → 转为 `done`，标记 `adjustmentType=makeup`、`source=retroactive`。
- 若无记录 → 新建 `done` 记录，标记 `source=retroactive`。
- 之后 `syncPlanCounts` 重算计数。

**响应**：返回补录后的 Checkin 对象。

### 5.5 打卡详情 `GET /checkins/:id`
返回单条 Checkin 对象。

### 5.6 修改打卡状态 `PATCH /checkins/:id`
**请求**：`{ "status": "missed", "remark": "发烧" }`（status/value/remark 均可选）
> 快速改状态，状态变化时 `syncPlanCounts` 重算。

### 5.7 调整排期 `POST /checkins/:id/reschedule`

> 改单次打卡的日期/时间，保留原排期用于追溯。

**请求**
```json
{
  "newDate": "2026-06-25",
  "newTime": "15:00"
}
```

**处理逻辑**
1. 校验 checkin 属于当前用户。
2. 检查目标槽位是否冲突（已有记录则返回 2003 CONFLICT）。
3. 首次调整时冻结 `originalScheduledDate`/`originalScheduledTime`（二次调整不覆盖原值）。
4. 标记 `adjustmentType=reschedule`。

**响应**：返回调整后的 Checkin 对象（含 originalScheduledDate 等追溯字段）。

### 5.8 删除打卡 `DELETE /checkins/:id`
软删除。之后 `syncPlanCounts` 重算计数。

---

## 六、统计模块

### 6.1 首页概览 `GET /stats/overview`

**响应**：今日打卡页用。
```json
{
  "code": 0,
  "data": {
    "totalPlans": 3,
    "todayTodo": 2,
    "todayDone": 1,
    "weekMissed": 1,
    "todayTodoList": [
      {
        "checkinId": 50001,
        "planId": 2001,
        "planName": "钢琴课",
        "planColor": "#AF52DE",
        "scheduledDate": "2026-06-30",
        "scheduledTime": "18:00"
      }
    ],
    "todayDoneList": [
      {
        "checkinId": 50002,
        "planId": 2003,
        "planName": "量血压",
        "scheduledTime": "08:00"
      }
    ]
  }
}
```
> `weekMissed`：M1 实现为"缺席总数"（简化，未按本周筛选），后续可精确为本周。

### 6.2 计划进度 `GET /plans/:id/progress`

**响应**：多口径进度 + 深度统计。
```json
{
  "code": 0,
  "data": {
    "totalDone": 29,          // initialDoneCount + doneCount
    "consumed": 29,           // totalDone + (absenceConsumes ? missedCount : 0)，无限计划为 null
    "remain": 31,             // totalCount - consumed，无限计划为 null
    "progress": 0.48,         // consumed / totalCount，无限计划为 null
    "doneCount": 11,
    "missedCount": 1,
    "streak": 5,              // 连续打卡天数（按排期连续）
    "completionRate": 0.92,   // done/(done+missed)，无记录为 null
    "estimatedEndDate": "2026-11-15"  // 按排期节奏估算，无限/flexible 为 null
  }
}
```

### 6.3 缺席列表 `GET /stats/missed`

**Query 参数**
| 参数 | 类型 | 说明 |
|---|---|---|
| `planId` | number | 可选，限定某计划 |
| `page` / `pageSize` | number | 分页 |

**响应**：所有计划的 missed 记录，按时间倒序。list 项为完整 Checkin 对象 + `planName` + `planColor`。
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 50009,
        "planId": 2001,
        "scheduledDate": "2026-06-09",
        "scheduledTime": "18:00",
        "status": "missed",
        "remark": "发烧",
        "source": "scheduled",
        "adjustmentType": null,
        "planName": "钢琴课",
        "planColor": "#AF52DE"
      }
    ],
    "total": 8,
    "page": 1,
    "pageSize": 20
  }
}
```
    ]
  }
}
```

### 6.2 计划进度 `GET /plans/:id/progress`
**响应**
```json
{
  "code": 0,
  "data": {
    "totalCount": 60,
    "usedCount": 18,
    "missedCount": 2,
    "remainCount": 42,
    "progress": 0.3,
    "streak": 5,              // 连续按时打卡次数
    "completionRate": 0.9,    // 应打卡中 done 占比（排除 pending）
    "estimatedEndDate": "2026-11-15"
  }
}
```

### 6.3 缺席列表 `GET /stats/missed`

**Query 参数**
| 参数 | 类型 | 说明 |
|---|---|---|
| `planId` | number | 可选，限定某计划 |
| `startDate` / `endDate` | date | 日期范围 |
| `page` / `pageSize` | number | 分页 |

**响应**：所有计划的 missed 记录，按时间倒序。
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 50009,
        "planId": 2001,
        "planName": "钢琴课",
        "planColor": "#9C27B0",
        "scheduledDate": "2026-06-09",
        "scheduledTime": "18:00",
        "remark": "发烧",
        "canRecall": true   // 是否可"回想补备注"
      }
    ],
    "total": 8,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 七、接口安全与限流

- **鉴权**：除 `/auth/login`、`/auth/refresh` 外，全部需 `Authorization: Bearer <token>`。
- **越权防护**：所有查询/操作都校验 `userId` 归属，例如 `GET /plans/:id` 会校验 `plan.user_id === currentUserId`，否则返回 `2002 资源不存在`（不暴露存在性）。
- **限流**：单 IP 100 次/分钟；单用户 60 次/分钟（Redis 滑窗），超限返回 `3001`。
- **幂等**：打卡接口 upsert 天然幂等，防重复提交。
- **日志**：所有写操作（POST/PUT/PATCH/DELETE）记录操作日志（userId、接口、参数、IP、耗时）。

---

## 八、OpenAPI 规范

> 开发阶段在 `packages/server/src/openapi.yaml` 维护完整的 OpenAPI 3.0 规范文件，可一键生成：
> - 前端接口请求代码（TypeScript 类型 + api 封装）
> - API 调试文档（Swagger UI，挂在 `/api/docs` 路径，仅开发环境开放）
