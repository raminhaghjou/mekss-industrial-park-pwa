# Build stage: install the full lockfile dependency set before Prisma generation and Nest compilation.
# Debian (glibc) rather than Alpine: onnxruntime-node and sharp ship glibc prebuilt binaries.
FROM node:20-bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# Runtime stage: keep only production dependencies and generated runtime artifacts.
FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 --system mekss \
    && useradd --uid 1001 --system --gid mekss --no-create-home mekss
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=mekss:mekss /app/dist ./dist
COPY --from=builder --chown=mekss:mekss /app/prisma ./prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=mekss:mekss /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Engine B (in-process ANPR) reads the same ONNX models as the Python service; mount the shared volume here.
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
