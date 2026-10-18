#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Production start ────────────────────────────────────────────────────────
# Huddle (huddle.kinddot.net): one Node + Socket.IO process (host/) serves the
# game picker at / (hub/index.html), Bomb Busters at /boom-buster/, Regicide
# at /regicide/ and Codenames at /codenames/ (each game's built client in games/<game>/client/dist plus its
# game socket), all on one port.
#
# Settings come from .env (optional):
#   PORT  default 3001
#   HOST  default 0.0.0.0 (reachable from other devices on your network);
#         set HOST=127.0.0.1 when a reverse proxy (e.g. Caddy) sits in front.
#
# Rooms live in memory: restarting the server ends any game in progress. So
# this first asks the running server (npm run status) and, if games are in
# progress, shows them and asks before going on. ./run.sh --yes skips the
# question (needed when there's no terminal to answer it, e.g. in CI).

FORCE=0
for arg in "$@"; do
	case "$arg" in -y|--yes|--force) FORCE=1 ;; esac
done

# Without tsx (first install) there's nothing of ours running to check.
if [ "$FORCE" = 0 ] && [ -x ./node_modules/.bin/tsx ]; then
	set +e
	STATUS_OUT=$(npm run -s status 2>&1)
	STATUS=$?
	set -e
	# Exit 1 = games in progress; 0 = none; 2 = server not running. Both of the latter go ahead.
	if [ "$STATUS" = 1 ] && grep -q "in progress" <<<"$STATUS_OUT"; then
		echo "$STATUS_OUT"
		echo ""
		if [ -t 0 ]; then
			read -r -p "Restart anyway and end these games? [y/N] " ANSWER || ANSWER=""
			case "$ANSWER" in
				y|Y|yes|YES) echo "Restarting." ;;
				*) echo "Not restarting."; exit 1 ;;
			esac
		else
			echo "Not restarting: no terminal to confirm. Run ./run.sh --yes to restart anyway."
			exit 1
		fi
	fi
fi

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
