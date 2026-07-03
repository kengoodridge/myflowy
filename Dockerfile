# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS build
RUN apk upgrade --no-cache
WORKDIR /app

# Dependency layer — only re-runs when package files change
COPY package.json yarn.lock ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json  ./packages/web/
RUN yarn install --frozen-lockfile

# Source layer
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/web  ./packages/web

# VITE_GOOGLE_CLIENT_ID is baked in at build time.
# Pass it with: --build-arg VITE_GOOGLE_CLIENT_ID=<your-id>
# Omit it to build an offline-only image (no Drive sync).
# Optional: override idle resync timer with --build-arg VITE_IDLE_RESYNC_MS=<milliseconds>
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_IDLE_RESYNC_MS=60000
ENV VITE_IDLE_RESYNC_MS=$VITE_IDLE_RESYNC_MS

RUN yarn build:core && yarn build:web

# ── Serve ───────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine3.21
RUN apk upgrade --no-cache
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
