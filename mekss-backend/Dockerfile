# Build stage: install the full lockfile dependency set before Prisma generation and Nest compilation.
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# Runtime stage: keep only production dependencies and generated runtime artifacts.
FROM node:20-alpine AS runtime

RUN apk add --no-cache dumb-init openssl \
    && addgroup --gid 1001 --system mekss \
    && adduser --uid 1001 --system --ingroup mekss mekss
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=mekss:mekss /app/dist ./dist
COPY --from=builder --chown=mekss:mekss /app/prisma ./prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/@prisma/client ./node_modules/@prisma/client
RUN mkdir -p uploads logs && chown -R mekss:mekss uploads logs

USER 1001
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

LABEL org.opencontainers.image.title="MEKSS backend" \
      org.opencontainers.image.description="MEKSS Industrial Park NestJS API"
