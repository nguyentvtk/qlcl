# ============================================================
# Frontend Dockerfile - Multi-stage build
# Stage 1: Build React app với Vite
# Stage 2: Nginx serve static files
# ============================================================

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args cho API URL (truyền từ docker-compose)
ARG VITE_API_URL=https://yourdomain.com/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ============================================================
# Stage 2: Nginx serve static files
# ============================================================
FROM nginx:1.27-alpine AS runtime

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Config nginx cho SPA (redirect tất cả về index.html)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ { \
        expires 1y; add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
