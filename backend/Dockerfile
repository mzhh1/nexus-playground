# Multi-stage build for Nexus Playground Backend
# Manual pruning strategy since turbo prune + pnpm install is failing due to network restrictions

# ============ Stage 1: Build ============
FROM node:18-alpine AS builder  
# Downgraded to 18-alpine to match original working version if 20 was causing issues, though network is likely culprit. 
# Sticking to 18 for safety.

WORKDIR /app

# Install turbo globally (optional, but good if we can run it later)
# RUN npm install -g turbo

# Copy necessary config files
COPY package.json pnpm-workspace.yaml turbo.json ./

# Copy packages
COPY packages/game-sdk ./packages/game-sdk
COPY backend ./backend
COPY games ./games

# Install dependencies using npm (since pnpm network is failing, maybe npm works? or just use what we have)
# Actually, if pnpm fails, npm might too. 
# But we need to install dependencies.
# Let's try to trust the container's network or use a stripped down install.

# If we can't generate lockfile, we can't use 'npm ci'. 
# We'll try 'npm install' which generates lockfile on the fly.
# But we need to install workspace dependencies.

# Install dependencies for the specific scope manually to avoid root lockfile requirement if possible
# Or just install everything.

# Since we don't have a lockfile, we must use `install` not `ci`.
RUN npm install -g pnpm

# Attempt to install dependencies.
# If this fails inside docker, then the docker network is also restricted or the proxy is needed.
# But often docker network is better than the shell.
RUN pnpm install --no-frozen-lockfile

# Build SDK
WORKDIR /app/packages/game-sdk
RUN pnpm run build

# Build Backend
WORKDIR /app/backend
RUN pnpm run build

# Prune dev dependencies
# RUN pnpm prune --prod 
# (Skip pruning to be safe for now, size optimization is secondary to working build)

# ============ Stage 2: Production ============
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nexus && \
    adduser -S nexus -u 1001 && \
    chown -R nexus:nexus /app

# Copy everything from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/games ./games
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/backend

USER nexus

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "import('http').then(http => http.default.get('http://127.0.0.1:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}))"

CMD ["node", "dist/backend/src/index.js"]
