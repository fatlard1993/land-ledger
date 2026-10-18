import { createHash, timingSafeEqual } from 'crypto';

import { nanoid } from 'nanoid';
import settingsDb from './database/settings';

// Tokens are kept only as their sha256 digest, so the settings file alone can't sign anyone in
export const digest = token => createHash('sha256').update(token).digest('hex');

const sameDigest = (a, b) =>
	typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ── Session store ──────────────────────────────────────────────────────────────
// Kept in the settings file by digest, so a restart doesn't sign everyone out.

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sessions = () => settingsDb.get('sessions') ?? {};
const expired = session => Date.now() - session.createdAt > SESSION_TTL_MS;

const saveSessions = next =>
	settingsDb.set('sessions', next).catch(error => console.error('[auth] sessions not saved:', error));

// Drops sessions that have run out — called once settings are loaded
export async function pruneSessions() {
	const kept = Object.fromEntries(Object.entries(sessions()).filter(([, session]) => !expired(session)));

	if (Object.keys(kept).length !== Object.keys(sessions()).length) await saveSessions(kept);
}

// Whether TLS is active — set by index.js after cert detection
let _tlsActive = false;
export function setTlsActive(active) {
	_tlsActive = active;
}

export async function createSession(account) {
	const token = nanoid(48);

	await saveSessions({
		...sessions(),
		[digest(token)]: { id: account.id, name: account.name, roles: account.roles, createdAt: Date.now() },
	});

	return token;
}

function tokenFromRequest(request) {
	const match = /ll_session=([^;]+)/.exec(request.headers.get('cookie') || '');
	return match?.[1] ?? null;
}

export function getSession(request) {
	const token = tokenFromRequest(request);

	if (!token) return null;

	const key = digest(token);
	const session = Object.hasOwn(sessions(), key) ? sessions()[key] : null;

	if (!session) return null;

	if (expired(session)) {
		const { [key]: _, ...rest } = sessions();

		saveSessions(rest);
		return null;
	}

	return session;
}

export async function destroySession(request) {
	const token = tokenFromRequest(request);

	if (!token) return;

	const { [digest(token)]: _, ...rest } = sessions();

	await saveSessions(rest);
}

export function sessionCookie(token, clear = false) {
	const secure = _tlsActive ? '; Secure' : '';

	return clear
		? `ll_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
		: `ll_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`;
}

// ── API token auth ─────────────────────────────────────────────────────────────
// Long-lived tokens for programmatic/external access, stored as their digest.

// Tokens saved before they were hashed: each keeps working, now kept as its digest
export async function migrateApiTokens() {
	const tokens = settingsDb.get('apiTokens') ?? [];

	if (!tokens.some(record => record.token)) return;

	await settingsDb.set(
		'apiTokens',
		tokens.map(({ token, ...record }) => (token ? { ...record, tokenHash: digest(token) } : record)),
	);
}

function getSessionFromBearer(request) {
	const auth = request.headers.get('authorization') || '';
	const match = /^Bearer\s+(.+)$/i.exec(auth);
	const token = match?.[1];

	if (!token) return null;

	const tokens = settingsDb.get('apiTokens') ?? [];
	const hash = digest(token);
	const record = tokens.find(t => sameDigest(t.tokenHash, hash));

	if (!record) return null;

	// Track last-used at minute precision — avoids a disk write on every request.
	const nowMinute = new Date().toISOString().slice(0, 16);
	if (record.lastUsed?.slice(0, 16) !== nowMinute) {
		const updated = tokens.map(t => (t.id === record.id ? { ...t, lastUsed: new Date().toISOString() } : t));
		settingsDb.set('apiTokens', updated).catch(() => {});
	}

	return { id: record.accountId, name: record.name ?? record.tokenName, roles: record.roles };
}

// Resolves the caller's identity from either a cookie session or a Bearer token.
export function resolveSession(request) {
	return getSession(request) ?? getSessionFromBearer(request);
}

// ── Auth middleware helpers ────────────────────────────────────────────────────

// Returns a rejection Response, or null to allow the request through.
// When auth is disabled globally, always returns null.
export function requireAuth(request) {
	if (!settingsDb.get('authEnabled')) return null;

	if (!resolveSession(request)) return new Response(null, { status: 401 });

	return null;
}

// Like requireAuth but also checks that the session has at least one of the
// specified roles. Admin always passes regardless of roles listed.
export function requireRole(request, roles = []) {
	if (!settingsDb.get('authEnabled')) return null;

	const session = resolveSession(request);

	if (!session) return new Response(null, { status: 401 });

	if (session.roles.admin) return null;

	if (roles.length && !roles.some(r => session.roles[r])) {
		return new Response(null, { status: 403 });
	}

	return null;
}
