# Notification Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/notification/package*.json ./services/notification/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/notification && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/notification/src/ ./services/notification/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/notification ./services/notification

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3005 3001

CMD ["node", "services/notification/src/index.js"]