#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Production start ────────────────────────────────────────────────────────
# Huddle (huddle.kinddot.net): one Node + Socket.IO process (host/) serves the
# game picker at / (hub/index.html), Bomb Busters at /boom-buster/ and Regicide
# at /regicide/ (each game's built client in games/<game>/client/dist plus its
# game socket), all on one port.
#
# Settings come from .env (optional):
#   PORT  default 3001
#   HOST  default 0.0.0.0 (reachable from other devices on your network);
#         set HOST=127.0.0.1 when a reverse proxy (e.g. Caddy) sits in front.
#
# Rooms live in memory: restarting the server ends any game in progress.

npm install
npm run build   # Vite build of each games/<game>/client → its dist/

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
$PM2 delete huddle >/dev/null 2>&1 || true
$PM2 delete bomb-busters >/dev/null 2>&1 || true   # the app's name before the repo was renamed
$PM2 start ecosystem.config.cjs
$PM2 save 2>/dev/null || true

set -a; [ -f .env ] && . ./.env; set +a
echo ""
echo "✅ Huddle running (production build) on ${HOST:-0.0.0.0}:${PORT:-3001}."
echo "   Local URL:  http://localhost:${PORT:-3001}  (Bomb Busters: /boom-buster/, Regicide: /regicide/)"
echo ""
echo "Useful commands:"
echo "  $PM2 status               — show running status"
echo "  $PM2 logs huddle          — tail the logs"
echo "  $PM2 stop huddle          — stop the server"
