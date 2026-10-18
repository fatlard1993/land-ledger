#!/usr/bin/env sh
# Land Ledger installer — https://github.com/fatlard1993/land-ledger
#
# Usage (fresh install or update — same command):
#   curl -fsSL https://raw.githubusercontent.com/fatlard1993/land-ledger/main/scripts/install.sh | sh
#
# Installs to ~/.land-ledger/ and registers a background service that starts on login.
# Supports macOS (launchd), Linux (systemd), and WSL.

set -e

REPO="https://github.com/fatlard1993/land-ledger"
RAW="https://raw.githubusercontent.com/fatlard1993/land-ledger/main"
APP="$HOME/.land-ledger"
PORT="${LAND_LEDGER_PORT:-7450}"

# ── Terminal colors ────────────────────────────────────────────────────────────

if [ -t 1 ]; then
	GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; BLD='\033[1m'; RST='\033[0m'
else
	GRN=''; YLW=''; RED=''; BLD=''; RST=''
fi

say()  { printf "${GRN}▸${RST} %s\n" "$*"; }
warn() { printf "${YLW}⚠  %s${RST}\n" "$*"; }
die()  { printf "${RED}✗  %s${RST}\n" "$*" >&2; exit 1; }
hdr()  { printf "\n${BLD}%s${RST}\n" "$*"; }

# ── Bun ────────────────────────────────────────────────────────────────────────

hdr "Checking prerequisites"

# Bun may be installed but not on PATH yet — check common locations first
for _candidate in "$HOME/.bun/bin/bun" "$HOME/.local/bin/bun" "/usr/local/bin/bun"; do
	if [ -x "$_candidate" ] && ! command -v bun >/dev/null 2>&1; then
		_cdir="$(dirname "$_candidate")"
		export PATH="$_cdir:$PATH"
		break
	fi
done

if ! command -v bun >/dev/null 2>&1; then
	say "Bun not found — installing…"
	curl -fsSL https://bun.sh/install | bash
	export BUN_INSTALL="$HOME/.bun"
	export PATH="$BUN_INSTALL/bin:$PATH"
fi

command -v bun >/dev/null 2>&1 || die "Bun install failed. Install it from https://bun.sh then re-run."
say "Bun $(bun --version)"

command -v git >/dev/null 2>&1 || die "git is required.\n  macOS:          xcode-select --install\n  Ubuntu/Debian:  sudo apt install git"
say "git $(git --version | awk '{print $3}')"

# ── Clone or update ────────────────────────────────────────────────────────────

hdr "Fetching source"

FRESH_INSTALL=true

if [ -d "$APP/.git" ]; then
	FRESH_INSTALL=false
	say "Updating…"
	git -C "$APP" pull --ff-only
else
	say "Cloning…"
	git clone --depth=1 "$REPO" "$APP"
fi

# ── Install dependencies & build ───────────────────────────────────────────────

hdr "Building"

cd "$APP"

say "Installing dependencies…"
bun install

say "Building client…"
bun run build

# ── Service ────────────────────────────────────────────────────────────────────

hdr "Service"

_platform="$(uname)"

_systemd_available() {
	command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1
}

# Installs from before the shared service script ran under launchd as com.landledger.app; retire that agent so the
# new one (com.vanilla-bean.land-ledger) isn't fighting it for the port
_OLD_PLIST="$HOME/Library/LaunchAgents/com.landledger.app.plist"
if [ "$_platform" = "Darwin" ] && [ -f "$_OLD_PLIST" ]; then
	say "Retiring the old launchd agent…"
	launchctl bootout "gui/$(id -u)/com.landledger.app" 2>/dev/null || true
	rm -f "$_OLD_PLIST"
	FRESH_INSTALL=true
fi

if [ "$FRESH_INSTALL" = "true" ]; then
	if [ "$_platform" = "Darwin" ]; then
		say "Registering launchd service…"
		bun run service:enable --port "$PORT"

	elif _systemd_available; then
		say "Registering systemd user service…"
		bun run service:enable --port "$PORT"
		# Persist the service without an active login session (always-on boxes, servers)
		if command -v loginctl >/dev/null 2>&1; then
			loginctl enable-linger "$(id -un)" 2>/dev/null && say "loginctl linger enabled — service persists without login." || true
		fi

	else
		# WSL1 or Linux without a systemd user session — start in background with nohup
		warn "systemd user session not available (WSL1 or headless without --user session)."
		warn "Land Ledger is starting in the background now."
		warn "To start it automatically on login, add this line to ~/.bashrc or ~/.zshrc:"
		warn ""
		warn "  (cd $APP && NODE_ENV=production nohup bun server/index.js >> ~/.landLedger.log 2>&1 &)"
		warn ""
		# shellcheck disable=SC2086
		NODE_ENV=production nohup bun server/index.js >> "$HOME/.landLedger.log" 2>&1 &
		say "Started in background (PID $!)."
	fi

else
	# Update — service already installed, reload it with the new build
	if [ "$_platform" = "Darwin" ]; then
		say "Reloading service…"
		bun run service:reload
	elif _systemd_available && systemctl --user is-active land-ledger >/dev/null 2>&1; then
		say "Reloading service…"
		bun run service:reload
	else
		warn "Service not active — start it with: cd $APP && bun run service:start"
	fi
fi

# ── Health check ──────────────────────────────────────────────────────────────

hdr "Verifying"

_max=15
_i=0
_up=false

while [ $_i -lt $_max ]; do
	if curl -sf "http://localhost:$PORT/api" >/dev/null 2>&1; then
		_up=true
		break
	fi
	_i=$((_i + 1))
	sleep 1
done

# ── Done ───────────────────────────────────────────────────────────────────────

hdr "Done"

printf "\n"

if [ "$_up" = "true" ]; then
	printf "  %sLand Ledger is running at http://localhost:%s%s\n" "${GRN}${BLD}" "$PORT" "$RST"
else
	warn "Server did not respond within 15 seconds."
	warn "Check logs: cd $APP && bun run service:logs"
fi

printf "\n"
printf "  Update:   curl -fsSL %s/scripts/install.sh | sh\n" "$RAW"
printf "  Stop:     cd %s && bun run service:stop\n" "$APP"
printf "  Logs:     cd %s && bun run service:logs\n" "$APP"
printf "\n"
