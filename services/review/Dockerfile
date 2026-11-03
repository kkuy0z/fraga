# Review Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/review/package*.json ./services/review/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/review && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/review/src/ ./services/review/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/review ./services/review

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3007

CMD ["node", "services/review/src/index.js"]