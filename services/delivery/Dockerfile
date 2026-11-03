# Delivery Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/delivery/package*.json ./services/delivery/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/delivery && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/delivery/src/ ./services/delivery/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/delivery ./services/delivery

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3004

CMD ["node", "services/delivery/src/index.js"]