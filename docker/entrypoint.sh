#!/bin/sh
# ---------------------------------------------------------------------------
# Homepage Manager container entrypoint.
#
# Runs the app as a NON-ROOT user by default (uid/gid 1000, configurable via
# $PUID/$PGID). When the container is launched as root it drops privileges to
# the requested uid/gid so it can write to a config directory you own on the
# host (run `id -u` / `id -g` on the host and pass them through).
# ---------------------------------------------------------------------------
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Ensure our own application-data directory is writable.
mkdir -p "${HOMEPAGE_MANAGER_DATA_DIR:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  # (re)create the app user to match the requested ids.
  getent group homepage >/dev/null 2>&1 || groupadd -g 10000 homepage
  groupmod -o -g "$PGID" homepage 2>/dev/null || true
  usermod -o -u "$PUID" -g "$PGID" homepage 2>/dev/null || useradd -u "$PUID" -g "$PGID" -d /app -s /bin/sh homepage
  chown -R homepage:homepage "${HOMEPAGE_MANAGER_DATA_DIR:-/app/data}" 2>/dev/null || true
  echo "[homepage-manager] dropping privileges to UID=$PUID GID=$PGID"
  exec su-exec homepage:homepage "$@"
fi

# Already a non-root user (e.g. `user:` set in compose) — run directly.
exec "$@"
