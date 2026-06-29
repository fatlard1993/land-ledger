#!/usr/bin/env bun
/**
 * Generates a self-signed TLS certificate for local HTTPS.
 * Required for PWA (service worker) support when accessing the app from a
 * tablet or phone on the same network — browsers only allow service workers
 * on HTTPS origins (except localhost).
 *
 * Run once: bun run cert
 *
 * After running, restart the server. It will detect the cert and switch to
 * HTTPS automatically. On each device that accesses the app:
 *   1. Visit https://<server-ip>:7450
 *   2. Accept the security warning (or install the cert for no warning)
 */

import os from 'os';
import path from 'path';
import { existsSync } from 'fs';

const DB_PATH = path.join(os.homedir(), '.landLedger.json');
const CERT_PATH = DB_PATH.replace('.json', '-cert.pem');
const KEY_PATH = DB_PATH.replace('.json', '-key.pem');

if (existsSync(CERT_PATH) && existsSync(KEY_PATH)) {
	console.log('Certificate already exists:');
	console.log(`  cert: ${CERT_PATH}`);
	console.log(`  key:  ${KEY_PATH}`);
	console.log('\nDelete these files and re-run to regenerate.');
	process.exit(0);
}

// Collect all local IP addresses for Subject Alternative Names
const localIPs = Object.values(os.networkInterfaces())
	.flat()
	// eslint-disable-next-line spellcheck/spell-checker
	.filter(a => a.family === 'IPv4')
	.map(a => `IP:${a.address}`);

const san = [...new Set(['IP:127.0.0.1', 'DNS:localhost', ...localIPs])].join(',');

console.log(`Generating certificate (SANs: ${san})…`);

const proc = Bun.spawn(
	[
		'openssl',
		'req',
		'-x509',
		'-newkey',
		'rsa:2048',
		'-sha256',
		'-days',
		'3650',
		'-nodes',
		'-keyout',
		KEY_PATH,
		'-out',
		CERT_PATH,
		'-subj',
		'/CN=Land Ledger',
		'-addext',
		`subjectAltName=${san}`,
	],
	{ stdout: 'pipe', stderr: 'pipe' },
);

await proc.exited;

if (proc.exitCode !== 0) {
	const err = await new Response(proc.stderr).text();

	console.error('openssl failed:', err);
	console.error('\nMake sure openssl is installed and on your PATH.');
	process.exit(1);
}

// Restrict private key to owner-read-only — openssl defaults to 0644
const chmod = Bun.spawn(['chmod', '600', KEY_PATH], { stdout: 'pipe', stderr: 'pipe' });
await chmod.exited;

console.log('\nCertificate generated:');
console.log(`  cert: ${CERT_PATH}`);
console.log(`  key:  ${KEY_PATH}`);
console.log('\nRestart the server — it will automatically switch to HTTPS.');
console.log('\nOn each device, visit https://<server-ip>:7450 and accept the');
console.log('security warning, or install the certificate from:');
console.log(`  ${CERT_PATH}`);
