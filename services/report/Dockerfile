# Report Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/report/package*.json ./services/report/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/report && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/report/src/ ./services/report/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/report ./services/report

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3006

CMD ["node", "services/report/src/index.js"]