# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
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
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN yarn build:core && yarn build:web

# ── Serve ───────────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
