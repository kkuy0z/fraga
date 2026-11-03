# Frontend Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/frontend/package*.json ./services/frontend/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/frontend && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/frontend/src/ ./services/frontend/src/
COPY inicio/ ./inicio/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/frontend ./services/frontend
COPY --from=builder /app/inicio ./inicio

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3009

CMD ["node", "services/frontend/src/index.js"]