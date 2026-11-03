# Menu Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/menu/package*.json ./services/menu/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/menu && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/menu/src/ ./services/menu/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/menu ./services/menu

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["node", "services/menu/src/index.js"]