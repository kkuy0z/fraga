# Base Dockerfile for Fraga Lanches Services
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/auth/package*.json ./services/auth/
COPY services/menu/package*.json ./services/menu/
COPY services/order/package*.json ./services/order/
COPY services/client/package*.json ./services/client/
COPY services/delivery/package*.json ./services/delivery/
COPY services/notification/package*.json ./services/notification/
COPY services/report/package*.json ./services/report/
COPY services/review/package*.json ./services/review/
COPY services/payment/package*.json ./services/payment/
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/frontend/package*.json ./services/frontend/

# Install all dependencies
RUN npm ci --workspaces --omit=dev 2>/dev/null || \
    (cd shared && npm ci --omit=dev) && \
    (cd services/auth && npm ci --omit=dev) && \
    (cd services/menu && npm ci --omit=dev) && \
    (cd services/order && npm ci --omit=dev) && \
    (cd services/client && npm ci --omit=dev) && \
    (cd services/delivery && npm ci --omit=dev) && \
    (cd services/notification && npm ci --omit=dev) && \
    (cd services/report && npm ci --omit=dev) && \
    (cd services/review && npm ci --omit=dev) && \
    (cd services/payment && npm ci --omit=dev) && \
    (cd services/api-gateway && npm ci --omit=dev) && \
    (cd services/frontend && npm ci --omit=dev)

# Copy source code
COPY shared/ ./shared/
COPY services/auth/src/ ./services/auth/src/
COPY services/menu/src/ ./services/menu/src/
COPY services/order/src/ ./services/order/src/
COPY services/client/src/ ./services/client/src/
COPY services/delivery/src/ ./services/delivery/src/
COPY services/notification/src/ ./services/notification/src/
COPY services/report/src/ ./services/report/src/
COPY services/review/src/ ./services/review/src/
COPY services/payment/src/ ./services/payment/src/
COPY services/api-gateway/src/ ./services/api-gateway/src/
COPY services/frontend/src/ ./services/frontend/src/
COPY inicio/ ./inicio/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 2999

# Default command (overridden in docker-compose)
CMD ["node", "services/api-gateway/src/index.js"]