# Payment Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY shared/package*.json ./shared/
COPY services/payment/package*.json ./services/payment/

RUN cd shared && npm ci --omit=dev && \
    cd ../services/payment && npm ci --omit=dev

COPY shared/ ./shared/
COPY services/payment/src/ ./services/payment/src/

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite

COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/payment ./services/payment

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3008

CMD ["node", "services/payment/src/index.js"]