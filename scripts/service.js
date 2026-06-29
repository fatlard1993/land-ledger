#!/usr/bin/env bun

/**
 * Service manager — installs and controls Land Ledger as a background service.
 *
 * macOS : launchd  (~/Library/LaunchAgents/com.landledger.app.plist)
 * Linux : systemd  (~/.config/systemd/user/land-ledger.service)
 *
 * Usage: bun scripts/service.js <enable|disable|start|stop|reload>
 */

import os from 'os';
import path from 'path';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const [, , command] = process.argv;
const HOME = os.homedir();
const APP_DIR = path.resolve(import.meta.dirname, '..');
const BUN = process.execPath; // absolute path — launchd/systemd don't use $PATH
const UID = process.getuid();

// ── macOS launchd ──────────────────────────────────────────────────────────────

const PLIST_LABEL = 'com.landledger.app';
const PLIST_PATH = path.join(HOME, 'Library', 'LaunchAgents', `${PLIST_LABEL}.plist`);

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>              <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${BUN}</string>
    <string>run</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>   <string>${APP_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>         <string>production</string>
  </dict>
  <key>RunAtLoad</key>          <true/>
  <key>KeepAlive</key>          <true/>
  <key>StandardOutPath</key>    <string>${HOME}/.landLedger.log</string>
  <key>StandardErrorPath</key>  <string>${HOME}/.landLedger.log</string>
</dict>
</plist>
`;

// ── Linux systemd ──────────────────────────────────────────────────────────────

const SYSTEMD_DIR = path.join(HOME, '.config', 'systemd', 'user');
const SERVICE_PATH = path.join(SYSTEMD_DIR, 'land-ledger.service');

const UNIT = `[Unit]
Description=Land Ledger farm management
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${BUN} run start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

const run = async (bin, args, { quiet = false } = {}) => {
	const p = Bun.spawn([bin, ...args], { stdout: 'inherit', stderr: quiet ? 'pipe' : 'inherit' });
	await p.exited;
	return p.exitCode;
};

// ── macOS handlers ─────────────────────────────────────────────────────────────

const mac = {
	async enable() {
		await writeFile(PLIST_PATH, PLIST, 'utf-8');
		// bootout first so enable is idempotent on updates; RunAtLoad starts it on bootstrap
		await run('launchctl', ['bootout', `gui/${UID}/${PLIST_LABEL}`], { quiet: true }).catch(() => {});
		await run('launchctl', ['bootstrap', `gui/${UID}`, PLIST_PATH]);
		console.log('Service installed — Land Ledger will start automatically on login.');
	},
	async disable() {
		await run('launchctl', ['bootout', `gui/${UID}/${PLIST_LABEL}`], { quiet: true }).catch(() => {});
		if (existsSync(PLIST_PATH)) await unlink(PLIST_PATH);
		console.log('Service removed.');
	},
	async start() {
		await run('launchctl', ['kickstart', `gui/${UID}/${PLIST_LABEL}`]);
	},
	async stop() {
		await run('launchctl', ['kill', 'SIGTERM', `gui/${UID}/${PLIST_LABEL}`], { quiet: true }).catch(() => {});
	},
	async reload() {
		// -k kills the running instance first, then starts a fresh one
		await run('launchctl', ['kickstart', '-k', `gui/${UID}/${PLIST_LABEL}`]);
	},
};

// ── Linux handlers ─────────────────────────────────────────────────────────────

const serviceUnitHandlers = {
	async enable() {
		await mkdir(SYSTEMD_DIR, { recursive: true });
		await writeFile(SERVICE_PATH, UNIT, 'utf-8');
		await run('systemctl', ['--user', 'daemon-reload']);
		// --now starts the service immediately, consistent with macOS RunAtLoad behaviour
		await run('systemctl', ['--user', 'enable', '--now', 'land-ledger']);
		console.log('Service installed — Land Ledger will start automatically on login.');
		console.log('Tip: run "loginctl enable-linger" to keep it running without an active login session.');
	},
	async disable() {
		await run('systemctl', ['--user', 'disable', '--now', 'land-ledger']).catch(() => {});
		if (existsSync(SERVICE_PATH)) await unlink(SERVICE_PATH);
		await run('systemctl', ['--user', 'daemon-reload']);
		console.log('Service removed.');
	},
	async start() {
		await run('systemctl', ['--user', 'start', 'land-ledger']);
	},
	async stop() {
		await run('systemctl', ['--user', 'stop', 'land-ledger'], { quiet: true }).catch(() => {});
	},
	async reload() {
		await run('systemctl', ['--user', 'restart', 'land-ledger']);
	},
};

// ── Dispatch ───────────────────────────────────────────────────────────────────

const VALID = ['enable', 'disable', 'start', 'stop', 'reload'];

if (!VALID.includes(command)) {
	console.error(`Usage: bun scripts/service.js <${VALID.join('|')}>`);
	process.exit(1);
}

const handlers = process.platform === 'darwin' ? mac : serviceUnitHandlers;

await handlers[command]();
