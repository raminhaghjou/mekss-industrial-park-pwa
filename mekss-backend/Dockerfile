# Build stage: install the full lockfile dependency set before Prisma generation and Nest compilation.
# Debian (glibc) rather than Alpine: onnxruntime-node and sharp ship glibc prebuilt binaries.
# Build stage
FROM node:20-bookworm-slim AS builder

# (اختیاری ولی توصیه‌شده) میرور apt ایرانی
RUN sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
 && sed -i 's|security.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# تنظیم میرور ایرانی + پایداری شبکه
RUN npm config set registry https://package-mirror.liara.ir/repository/npm/ \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set maxsockets 3

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:20-bookworm-slim AS runtime

# میرور apt
RUN sed -i 's|deb.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
 && sed -i 's|security.debian.org|mirror.iranserver.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 --system mekss \
    && useradd --uid 1001 --system --gid mekss --no-create-home mekss

WORKDIR /app

# مهم: دوباره میرور را تنظیم کن
RUN npm config set registry https://package-mirror.liara.ir/repository/npm/ \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set maxsockets 3

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=mekss:mekss /app/dist ./dist
COPY --from=builder --chown=mekss:mekss /app/prisma ./prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN mkdir -p uploads logs models/iran-plate && chown -R mekss:mekss uploads logs models

ENV ANPR_MODEL_DIR=/app/models/iran-plate
USER 1001
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

LABEL org.opencontainers.image.title="MEKSS backend" \
      org.opencontainers.image.description="MEKSS Industrial Park NestJS API"
