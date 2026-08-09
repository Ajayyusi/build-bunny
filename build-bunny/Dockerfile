# Build Bunny — production image (Next.js standalone output).
#
# Release process: run migrations BEFORE starting the container, as a separate
# release step (never baked into CMD, so a crash-looping app can't half-apply
# migrations and rollouts stay deterministic):
#
#   docker run --rm -e DATABASE_URL=... <image> npx prisma migrate deploy
#   docker run -d -e DATABASE_URL=... -e BETTER_AUTH_SECRET=... \
#     -e NEXT_PUBLIC_APP_URL=... -p 3000:3000 <image>

# ---- deps: install the full dependency tree once, cached by lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- builder: generate the Prisma client and compile the app ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` evaluates env validation; real values are injected at runtime,
# these ARG defaults exist only so the build can complete.
ARG DATABASE_URL="postgresql://bunny:bunny@localhost:5432/bunny_dev"
ARG BETTER_AUTH_SECRET="build-time-dummy-secret"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV DATABASE_URL=$DATABASE_URL \
    BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npx prisma generate
RUN npm run build

# ---- runner: minimal standalone server, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S bunny && adduser -S bunny -G bunny

# standalone bundles its own pruned node_modules; the Prisma schema +
# generated client (query engine binary lives in node_modules/.prisma)
# are copied explicitly so `prisma migrate deploy` and the client both work.
COPY --from=builder --chown=bunny:bunny /app/.next/standalone ./
COPY --from=builder --chown=bunny:bunny /app/.next/static ./.next/static
COPY --from=builder --chown=bunny:bunny /app/public ./public
COPY --from=builder --chown=bunny:bunny /app/prisma ./prisma
COPY --from=builder --chown=bunny:bunny /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=bunny:bunny /app/node_modules/@prisma ./node_modules/@prisma

USER bunny
EXPOSE 3000
CMD ["node", "server.js"]
