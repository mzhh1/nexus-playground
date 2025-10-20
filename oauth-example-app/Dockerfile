# AutoLab OAuth Example App - Dockerfile

# ============================================
# Stage 1: 构建阶段
# ============================================
FROM node:18-alpine AS builder

# 设置代理环境变量
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    http_proxy=${http_proxy} \
    https_proxy=${https_proxy}

WORKDIR /app

# 复制依赖文件
COPY ./oauth-example-app/package*.json ./

# 配置国内镜像源并安装依赖（无 lockfile 时使用 npm install）
RUN npm config set registry https://registry.npmmirror.com && \
    ( [ -f package-lock.json ] && npm ci || npm install --no-audit --no-fund )

# 复制源代码
COPY ./oauth-example-app .

# 显式传入各基础 URL（认证 API、数据服务、OAuth 回调与个人中心）
ARG VITE_AUTH_API_BASE_URL
ARG VITE_DATA_BASE_URL
ARG VITE_OAUTH_REDIRECT_URI
ARG VITE_OAUTH_PROFILE_URL
ARG VITE_OAUTH_SCOPE
ENV VITE_AUTH_API_BASE_URL=${VITE_AUTH_API_BASE_URL}
ENV VITE_DATA_BASE_URL=${VITE_DATA_BASE_URL}
ENV VITE_OAUTH_REDIRECT_URI=${VITE_OAUTH_REDIRECT_URI}
ENV VITE_OAUTH_PROFILE_URL=${VITE_OAUTH_PROFILE_URL}
ENV VITE_OAUTH_SCOPE=${VITE_OAUTH_SCOPE}

# 显式传入积分服务基础 URL
ARG VITE_POINTS_BASE_URL
ENV VITE_POINTS_BASE_URL=${VITE_POINTS_BASE_URL}

# 显式传入 LLM API 基础 URL
ARG VITE_LLMAPI_BASE_URL
ENV VITE_LLMAPI_BASE_URL=${VITE_LLMAPI_BASE_URL}

# 传递 OAuth Client ID（仅用于前端构建时注入，不包含密钥）
ARG VITE_OAUTH_CLIENT_ID
ENV VITE_OAUTH_CLIENT_ID=${VITE_OAUTH_CLIENT_ID}

# 构建应用
RUN npm run build

# ============================================
# Stage 2: 生产阶段 - Nginx
# ============================================
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY ./oauth-example-app/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


