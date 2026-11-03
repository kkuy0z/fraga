# Client Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/client/package*.json ./services/client/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/client && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/client/src/ ./services/client/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/client ./services/client

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3003

CMD ["node", "services/client/src/index.js"]