#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Production start ────────────────────────────────────────────────────────
# Builds the React client and runs the Node + Socket.IO server, which serves
# both the built client (packages/client/dist) and the game socket on one port.
#
# Settings come from .env (optional):
#   PORT  default 3001
#   HOST  default 0.0.0.0 (reachable from other devices on your network);
#         set HOST=127.0.0.1 when a reverse proxy (e.g. Caddy) sits in front.
#
# Rooms live in memory: restarting the server ends any game in progress.

npm install
npm run build   # Vite build of packages/client → packages/client/dist

# Resolve PM2: prefer global, fall back to local devDependency
if command -v pm2 >/dev/null 2>&1; then
	PM2=pm2
elif [ -x "./node_modules/.bin/pm2" ]; then
	PM2="./node_modules/.bin/pm2"
else
	echo "PM2 not found. Running the server in the foreground (Ctrl-C to stop)."
	echo "Install PM2 locally:  npm install --save-dev pm2"
	echo ""
	set -a; [ -f .env ] && . ./.env; set +a
	export NODE_ENV=production
	exec npm start
fi

mkdir -p logs
# Recreate so ecosystem changes (env, script) are picked up — `pm2 restart`
# alone reuses the old start parameters.
$PM2 delete bomb-busters >/dev/null 2>&1 || true
$PM2 start ecosystem.config.cjs
$PM2 save 2>/dev/null || true

set -a; [ -f .env ] && . ./.env; set +a
echo ""
echo "✅ Bomb Busters running (production build) on ${HOST:-0.0.0.0}:${PORT:-3001}."
echo "   Local URL:  http://localhost:${PORT:-3001}"
echo ""
echo "Useful commands:"
echo "  $PM2 status               — show running status"
echo "  $PM2 logs bomb-busters    — tail the logs"
echo "  $PM2 stop bomb-busters    — stop the server"
