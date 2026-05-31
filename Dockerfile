# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cache-friendly layer)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 botuser \
  && adduser --system --uid 1001 botuser

# Install production deps only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate \
  && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create data dir for SQLite with correct permissions
RUN mkdir -p /app/data && chown -R botuser:botuser /app/data

USER botuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
