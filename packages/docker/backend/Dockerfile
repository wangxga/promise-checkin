# 如约打卡后端 — 生产环境 Dockerfile
# 多阶段构建：编译 TS → 精简运行镜像

# ====== 阶段1：编译 ======
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl
RUN npm install -g pnpm

WORKDIR /build

ENV TZ=Asia/Shanghai

# 复制 workspace 根配置
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# 安装依赖
RUN CI=1 pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# 复制源码
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# 先编译 shared 包（server 编译依赖它的类型），再生成 Prisma Client，最后编译 server
RUN pnpm --filter @promise-checkin/shared build
RUN cd packages/server && npx prisma generate
RUN pnpm --filter @promise-checkin/server build

# ====== 阶段2：运行 ======
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production

WORKDIR /app

# 直接从 builder 复制编译产物 + 完整 node_modules（避免再装一次依赖）
COPY --from=builder /build/packages/server/dist/ ./dist/
COPY --from=builder /build/packages/server/prisma/ ./prisma/
COPY --from=builder /build/packages/server/package.json ./package.json
# shared 包只复制编译产物（dist）+ package.json，不复制 src
COPY --from=builder /build/packages/shared/dist/ ../shared/dist/
COPY --from=builder /build/packages/shared/package.json ../shared/package.json
COPY --from=builder /build/package.json ../package.json
COPY --from=builder /build/pnpm-workspace.yaml ../pnpm-workspace.yaml
COPY --from=builder /build/node_modules/ ../node_modules/
COPY --from=builder /build/packages/server/node_modules/ ./node_modules/
COPY --from=builder /build/packages/shared/node_modules/ ../shared/node_modules/

EXPOSE 3000

# 启动：先执行数据库迁移（自动建表/更新表结构），再启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
