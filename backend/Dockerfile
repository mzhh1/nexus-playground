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

# Copy game modules to parent directory to match tsconfig paths
COPY games /app/games

# Build TypeScript
RUN npm run build

# ============ Stage 2: Production ============
FROM node:18-alpine

WORKDIR /app/backend

# Install production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy tsconfig for path resolution
COPY backend/tsconfig.json ./

# Copy built files from builder
COPY --from=builder /app/backend/dist ./dist

# Copy game modules (needed at runtime for registry)
COPY --from=builder /app/games /app/games

# Create non-root user
RUN addgroup -g 1001 -S nexus && \
    adduser -S nexus -u 1001 && \
    chown -R nexus:nexus /app

USER nexus

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "import('http').then(http => http.default.get('http://127.0.0.1:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}))"

# Start the server
CMD ["node", "dist/backend/src/index.js"]

