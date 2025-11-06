# Multi-stage build for Nexus Playground Frontend

# ============ Stage 1: Build ============
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and game modules
COPY . .
COPY ../games ./games

# Build for production
RUN npm run build

# ============ Stage 2: Development ============
FROM node:18-alpine AS development

WORKDIR /app

# Create .bashrc file to prevent ENOENT errors from npm packages
RUN touch /root/.bashrc

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

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

