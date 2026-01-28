# Multi-stage build for LLM Monitor frontend

# ============ Stage 1: Build ==========
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# ============ Stage 2: Development ==========
FROM node:18-alpine AS development

WORKDIR /app

RUN touch /root/.bashrc

COPY package*.json ./

RUN npm install

COPY . .

ENV LLM_MONITOR_PORT=5174

EXPOSE 5174

CMD ["npm", "run", "dev"]

# ============ Stage 3: Production ==========
FROM nginx:1.25-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

