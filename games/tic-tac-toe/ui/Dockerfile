# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# 安装pnpm
RUN npm install -g pnpm

# 复制所有必要文件（使用.dockerignore排除node_modules等）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY games/tic-tac-toe/ui/package.json ./games/tic-tac-toe/ui/
COPY core-framework/packages/shared-types ./core-framework/packages/shared-types
COPY core-framework/packages/web-client ./core-framework/packages/web-client
COPY games/tic-tac-toe/game-logic ./games/tic-tac-toe/game-logic

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY games/tic-tac-toe/ui ./games/tic-tac-toe/ui
COPY tsconfig.json ./

# 构建依赖包
RUN pnpm --filter @nexus/shared-types build
RUN pnpm --filter @nexus/web-client build
RUN pnpm --filter @nexus/tic-tac-toe-logic build

# 构建UI应用
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=/ws
ARG VITE_AUTH_API_BASE_URL=/api
ARG VITE_OAUTH_CLIENT_ID
ARG VITE_OAUTH_REDIRECT_URI

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_AUTH_API_BASE_URL=${VITE_AUTH_API_BASE_URL}
ENV VITE_OAUTH_CLIENT_ID=${VITE_OAUTH_CLIENT_ID}
ENV VITE_OAUTH_REDIRECT_URI=${VITE_OAUTH_REDIRECT_URI}

RUN pnpm --filter @nexus/tic-tac-toe-ui build

# Stage 2: Production
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/games/tic-tac-toe/ui/dist /usr/share/nginx/html

# 复制nginx配置
COPY games/tic-tac-toe/ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


