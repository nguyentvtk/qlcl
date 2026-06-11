# ============================================================
# Backend Dockerfile - Multi-stage build
# Stage 1 (builder): cài dev dependencies + compile TypeScript
# Stage 2 (runtime): chỉ copy dist + production dependencies
# Giảm image size từ ~1GB xuống ~200MB
# ============================================================

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files trước để tận dụng Docker layer caching
# (chỉ rebuild khi package.json thay đổi)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source và compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ============================================================
# Stage 2: Runtime image (nhẹ hơn)
# ============================================================
FROM node:20-alpine AS runtime
WORKDIR /app

# Cài thêm wget để healthcheck
RUN apk add --no-cache wget

# Chỉ cài production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled code từ builder
COPY --from=builder /app/dist ./dist

# Tạo thư mục uploads và set ownership
RUN mkdir -p /app/uploads && chown -R node:node /app

# Dùng non-root user để tăng bảo mật
USER node

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
