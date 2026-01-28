# Multi-stage build for Nexus Playground Frontend

# ============ Stage 1: Build ============
FROM node:18-alpine AS builder

WORKDIR /app

# Copy and build the SDK first
COPY packages/game-sdk ./packages/game-sdk
WORKDIR /app/packages/game-sdk
RUN npm ci && npm run build

# Now set up frontend
WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies (this will use the local SDK from /app/packages/game-sdk)
RUN npm ci

# Copy source code and game modules
COPY frontend/ ./
COPY games ./games

# Build for production
RUN npm run build

# ============ Stage 2: Development ============
FROM node:18-alpine AS development

WORKDIR /app

# Create .bashrc file to prevent ENOENT errors from npm packages
RUN touch /root/.bashrc

# Copy and build the SDK first (must be done before npm ci to satisfy file: dependency)
COPY packages/game-sdk /app/packages/game-sdk
WORKDIR /app/packages/game-sdk
RUN npm ci && npm run build

# Now set up frontend
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (this will use the local SDK from /app/packages/game-sdk)
RUN npm ci

# Copy source code
COPY frontend/ ./

# Expose dev server port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev"]

# ============ Stage 3: Production ============
FROM nginx:1.25-alpine AS production

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (if needed)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
