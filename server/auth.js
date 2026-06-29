import { timingSafeEqual } from 'crypto';

import { nanoid } from 'nanoid';
import settingsDb from './database/settings';

// ── Session store ──────────────────────────────────────────────────────────────
// In-memory only — restart clears all sessions.
// Acceptable for a self-hosted single-server app.

const sessions = new Map(); // token → { id, name, roles, createdAt }
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Whether TLS is active — set by index.js after cert detection
let _tlsActive = false;
export function setTlsActive(active) {
	_tlsActive = active;
}

export function createSession(account) {
	const token = nanoid(48);

	sessions.set(token, {
		id: account.id,
		name: account.name,
		roles: account.roles,
		createdAt: Date.now(),
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

	const session = sessions.get(token);

	if (!session) return null;

	if (Date.now() - session.createdAt > SESSION_TTL_MS) {
		sessions.delete(token);
		return null;
	}

	return session;
}

export function destroySession(request) {
	const token = tokenFromRequest(request);

	if (token) sessions.delete(token);
}

export function sessionCookie(token, clear = false) {
	const secure = _tlsActive ? '; Secure' : '';

	return clear
		? `ll_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
		: `ll_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`;
}

// ── API token auth ─────────────────────────────────────────────────────────────
// Long-lived tokens for programmatic/external access.
// Tokens are stored plaintext in settingsDb — acceptable for a self-hosted app
// where anyone with file access already has access to all data.

function getSessionFromBearer(request) {
	const auth = request.headers.get('authorization') || '';
	const match = /^Bearer\s+(.+)$/i.exec(auth);
	const token = match?.[1];

	if (!token) return null;

	const tokens = settingsDb.get('apiTokens') ?? [];
	const tokenBuf = Buffer.from(token);
	const record = tokens.find(t => {
		try {
			return timingSafeEqual(Buffer.from(t.token), tokenBuf);
		} catch {
			return false;
		} // different lengths
	});

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
