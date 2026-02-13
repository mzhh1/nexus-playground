# Multi-stage build for Nexus Playground Backend

# ============ Stage 1: Build ============
FROM node:18-alpine AS builder

WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY backend/src ./src

# ============ Build SDK ============
# Copy SDK source
COPY packages/game-sdk /app/packages/game-sdk

# Install SDK dependencies (production only) - SDK is pre-built
WORKDIR /app/packages/game-sdk
RUN npm install --omit=dev

# ============ Build Backend ============
WORKDIR /app/backend
# Install SDK as local dependency
RUN npm install ../packages/game-sdk

# Build TypeScript
RUN npm run build

# ============ Stage 2: Production ============
# ============ Stage 2: Production ============
FROM node:18-alpine

# Use /app as base for shared node_modules
WORKDIR /app

# 1. Install SDK in /app/node_modules (Shared by Backend and Assets)
COPY packages/game-sdk ./packages/game-sdk
WORKDIR /app/packages/game-sdk
RUN npm install --omit=dev

WORKDIR /app
# Initialize a package.json to install the local SDK package
RUN npm init -y && npm install ./packages/game-sdk --omit=dev

# 2. Install Backend Dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# 3. Copy Code (Backend & Assets)
COPY --from=builder /app/backend/dist ./dist
COPY backend/tsconfig.json ./

# Copy pre-built Gomoku asset
COPY games/gomoku/dist /app/game-assets/gomoku

# Runtime Config
ENV NODE_ENV=production
ENV GAME_ASSETS_DIR=/app/game-assets
# NODE_PATH ensures backend can find modules in /app/node_modules too if standard resolution fails (though standard resolution should find parent)
ENV NODE_PATH=/app/node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "import('http').then(http => http.default.get('http://127.0.0.1:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}))"

# Start the server
CMD ["node", "dist/index.js"]

