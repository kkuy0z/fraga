# API Gateway Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/api-gateway/package*.json ./services/api-gateway/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/api-gateway && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/api-gateway/src/ ./services/api-gateway/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/api-gateway ./services/api-gateway

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 2999

CMD ["node", "services/api-gateway/src/index.js"]