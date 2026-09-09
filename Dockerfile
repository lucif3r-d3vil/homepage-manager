# syntax=docker/dockerfile:1

# ------------------------- build stage -------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (whole monorepo).
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY server ./server
COPY web ./web
RUN npm ci

# Build server (tsc) + web (vite) artifacts.
COPY . .
RUN npm run build

# ------------------------- runtime stage -------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    HOMEPAGE_MANAGER_DATA_DIR=/app/data \
    PUID=1000 \
    PGID=1000

RUN apk add --no-cache su-exec tini \
    && addgroup -g 10000 homepage \
    && adduser -D -H -u 10000 -G homepage homepage \
    && mkdir -p /app/data /docker \
    && chown -R homepage:homepage /app /docker

WORKDIR /app

# Production-only node_modules (no dev tooling in the shipped image).
COPY --chown=homepage:homepage package.json package-lock.json* ./
COPY --chown=homepage:homepage shared ./shared
COPY --chown=homepage:homepage server/package.json ./server/package.json
COPY --chown=homepage:homepage web/package.json ./web/package.json
RUN npm ci --omit=dev

# Compiled artifacts.
COPY --from=build --chown=homepage:homepage /app/server/dist ./server/dist
COPY --from=build --chown=homepage:homepage /app/web/dist ./web/dist

COPY --chown=homepage:homepage docker/entrypoint.sh /docker/entrypoint.sh
RUN chmod +x /docker/entrypoint.sh

EXPOSE 3001

# Tini reaps orphans; the entrypoint drops privileges then execs node.
ENTRYPOINT ["/sbin/tini", "--", "/docker/entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
