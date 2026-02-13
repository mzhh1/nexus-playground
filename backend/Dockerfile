# Multi-stage build for Nexus Playground Backend

# ============ Stage 1: Build ============
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy packages
COPY packages/game-sdk ./packages/game-sdk
COPY backend ./backend

# Install dependencies (frozen-lockfile is default for pnpm i in CI)
RUN pnpm install --frozen-lockfile

# Build SDK
WORKDIR /app/packages/game-sdk
RUN pnpm run build

# Build Backend
WORKDIR /app/backend
RUN pnpm run build

# ============ Stage 2: Production ============
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace config for minimal install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/game-sdk ./packages/game-sdk
COPY backend/package.json ./backend/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts
COPY --from=builder /app/packages/game-sdk/dist ./packages/game-sdk/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Copy other necessary backend files
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/

# Copy pre-built Gomoku asset
COPY games/gomoku/dist /app/game-assets/gomoku

# Runtime Config
ENV NODE_ENV=production
ENV GAME_ASSETS_DIR=/app/game-assets

# Set workdir to backend to run it
WORKDIR /app/backend

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "import('http').then(http => http.default.get('http://127.0.0.1:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}))"

# Start the server
CMD ["node", "dist/index.js"]

