# Auth Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY shared/package*.json ./shared/
COPY services/auth/package*.json ./services/auth/

# Install dependencies
RUN cd shared && npm ci --omit=dev && \
    cd ../services/auth && npm ci --omit=dev

# Copy source
COPY shared/ ./shared/
COPY services/auth/src/ ./services/auth/src/

# Runtime stage
FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

# Copy from builder
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/auth ./services/auth

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "services/auth/src/index.js"]