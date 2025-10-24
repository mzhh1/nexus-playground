# Nexus API Server Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

# 安装pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core-framework/api-server/package.json ./core-framework/api-server/
COPY core-framework/packages/shared-types ./core-framework/packages/shared-types
COPY core-framework/packages/game-sdk ./core-framework/packages/game-sdk
COPY core-framework/packages/platform-core ./core-framework/packages/platform-core

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY core-framework/api-server ./core-framework/api-server
COPY tsconfig.json ./

# 构建依赖包
RUN pnpm --filter @nexus/shared-types build
RUN pnpm --filter @nexus/game-sdk build
RUN pnpm --filter @nexus/platform-core build

# 构建API Server
RUN pnpm --filter @nexus/api-server build

# Production stage
FROM node:20-alpine

WORKDIR /app

# 安装pnpm
RUN npm install -g pnpm

# 复制构建产物和依赖
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core-framework/api-server/package.json ./core-framework/api-server/
COPY --from=builder /app/core-framework/api-server/dist ./core-framework/api-server/dist
COPY --from=builder /app/core-framework/packages ./core-framework/packages

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/core-framework/api-server

EXPOSE 4000

CMD ["node", "dist/index.js"]

