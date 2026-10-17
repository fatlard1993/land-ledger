import { nanoid } from 'nanoid';

import { requestMatch } from '@vanilla-bean/components/app';

import settingsDb from '../database/settings';
import { createSession, getSession, destroySession, sessionCookie, requireRole } from '../auth';

// ── Login rate limiting ────────────────────────────────────────────────────────
// Tracks failed login attempts globally with a rolling window.
// Sufficient for a self-hosted single-server app where the attack surface
// is the LAN — protects against automated scripts on any network path.
let _loginFailures = 0;
let _loginWindowStart = null;
const LOGIN_MAX_FAILURES = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function recordLoginFailure() {
	const now = Date.now();

	if (_loginWindowStart === null || now - _loginWindowStart > LOGIN_WINDOW_MS) {
		_loginFailures = 0;
		_loginWindowStart = now;
	}

	_loginFailures++;
}

function loginIsLocked() {
	if (_loginWindowStart === null) return false;

	if (Date.now() - _loginWindowStart > LOGIN_WINDOW_MS) {
		_loginFailures = 0;
		_loginWindowStart = null;
		return false;
	}

	return _loginFailures >= LOGIN_MAX_FAILURES;
}

// ── Public endpoints ───────────────────────────────────────────────────────────

// GET /auth/me — returns the current session's identity, or 401.
// The client calls this on startup to determine whether to show the login screen.
const handleMe = request => {
	if (!settingsDb.get('authEnabled')) return Response.json({ enabled: false });

	const session = getSession(request);

	if (!session) return new Response(null, { status: 401 });

	return Response.json({
		enabled: true,
		id: session.id,
		name: session.name,
		roles: session.roles,
	});
};

// POST /auth/login — accepts { passkey }, sets session cookie on success.
const handleLogin = async request => {
	if (loginIsLocked()) return new Response('Too many failed attempts — try again later', { status: 429 });

	let passkey;

	try {
		({ passkey } = await request.json());
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	if (!passkey) return new Response('passkey required', { status: 400 });

	const accounts = settingsDb.get('accounts') ?? [];

	// Verify against every account; first match wins. Intentionally sequential so
	// timing doesn't leak which account exists.
	let matched = null;

	for (const account of accounts) {
		const ok = await Bun.password.verify(passkey, account.passkey);

		if (ok) {
			matched = account;
			break;
		}
	}

	if (!matched) {
		recordLoginFailure();
		// Constant-time failure — sleep briefly so wrong passkeys don't return noticeably faster
		await Bun.sleep(200);

		return new Response('Invalid passkey', { status: 401 });
	}

	const token = createSession(matched);

	return new Response(null, {
		status: 204,
		headers: { 'Set-Cookie': sessionCookie(token) },
	});
};

// POST /auth/logout — clears the session.
const handleLogout = request => {
	destroySession(request);

	return new Response(null, {
		status: 204,
		headers: { 'Set-Cookie': sessionCookie('', true) },
	});
};

// ── Admin-only: auth settings ──────────────────────────────────────────────────

const handleGetSettings = request => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	return Response.json({
		authEnabled: settingsDb.get('authEnabled') ?? false,
		adminPasskeyIsDefault: settingsDb.get('adminPasskeyIsDefault') ?? false,
	});
};

const handlePatchSettings = async request => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { authEnabled } = body;

	if (authEnabled === true && settingsDb.get('adminPasskeyIsDefault')) {
		return new Response('Change the default admin passkey before enabling auth', { status: 400 });
	}

	if (typeof authEnabled === 'boolean') await settingsDb.set('authEnabled', authEnabled);

	return Response.json({ authEnabled: settingsDb.get('authEnabled') });
};

// ── Admin-only: account management ────────────────────────────────────────────

const handleListAccounts = request => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	const accounts = (settingsDb.get('accounts') ?? []).map(({ passkey: _, ...safe }) => safe);

	return Response.json(accounts);
};

const handleCreateAccount = async request => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	let body;

	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { name, passkey, roles = {} } = body;

	if (!name || !passkey) return new Response('name and passkey required', { status: 400 });

	const accounts = settingsDb.get('accounts') ?? [];
	const id = nanoid(8);
	const hashed = await Bun.password.hash(passkey);

	const account = {
		id,
		name,
		passkey: hashed,
		roles: { admin: false, financials: false, farmhand: true, ...roles },
	};

	accounts.push(account);
	await settingsDb.set('accounts', accounts);

	const { passkey: _, ...safe } = account;

	return Response.json(safe, { status: 201 });
};

const handleUpdateAccount = async (request, id) => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	const accounts = settingsDb.get('accounts') ?? [];
	const idx = accounts.findIndex(a => a.id === id);

	if (idx === -1) return new Response(null, { status: 404 });

	let body;

	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { name, passkey, roles } = body;

	if (name) accounts[idx].name = name;

	if (passkey) {
		accounts[idx].passkey = await Bun.password.hash(passkey);
		if (accounts[idx].id === 'admin') await settingsDb.set('adminPasskeyIsDefault', false);
	}

	if (roles) accounts[idx].roles = { ...accounts[idx].roles, ...roles };

	// Protect admin account from losing its admin role
	if (accounts[idx].id === 'admin') accounts[idx].roles.admin = true;

	await settingsDb.set('accounts', accounts);

	const { passkey: _, ...safe } = accounts[idx];

	return Response.json(safe);
};

const handleDeleteAccount = async (request, id) => {
	const guard = requireRole(request, ['admin']);

	if (guard) return guard;

	if (id === 'admin') return new Response('The admin account cannot be deleted', { status: 403 });

	const accounts = settingsDb.get('accounts') ?? [];
	const filtered = accounts.filter(a => a.id !== id);

	if (filtered.length === accounts.length) return new Response(null, { status: 404 });

	await settingsDb.set('accounts', filtered);

	return new Response(null, { status: 204 });
};

// ── Admin-only: API token management ──────────────────────────────────────────

const handleListTokens = request => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	const tokens = (settingsDb.get('apiTokens') ?? []).map(({ token: _, ...safe }) => safe);
	return Response.json(tokens);
};

const handleCreateToken = async request => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { name, roles } = body;
	if (!name) return new Response('name required', { status: 400 });

	const token = `ll_live_${nanoid(40)}`;
	const id = nanoid(8);
	const record = {
		id,
		name,
		accountId: 'admin',
		roles: { admin: false, financials: false, farmhand: true, ...roles },
		token,
		tokenPrefix: token.slice(0, 16), // first 16 chars for display
		createdAt: new Date().toISOString(),
		lastUsed: null,
	};

	const existing = settingsDb.get('apiTokens') ?? [];
	await settingsDb.set('apiTokens', [...existing, record]);

	// Return the full token ONCE — it is never returned again after this
	return Response.json(
		{ id, name, token, tokenPrefix: record.tokenPrefix, createdAt: record.createdAt },
		{ status: 201 },
	);
};

const handleRevokeToken = async (request, id) => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	const tokens = settingsDb.get('apiTokens') ?? [];
	const filtered = tokens.filter(t => t.id !== id);

	if (filtered.length === tokens.length) return new Response(null, { status: 404 });

	await settingsDb.set('apiTokens', filtered);
	return new Response(null, { status: 204 });
};

// ── Router ─────────────────────────────────────────────────────────────────────

const authRouter = async request => {
	if (requestMatch('GET', '/auth/me', request)) return handleMe(request);
	if (requestMatch('POST', '/auth/login', request)) return handleLogin(request);
	if (requestMatch('POST', '/auth/logout', request)) return handleLogout(request);

	if (requestMatch('GET', '/auth/settings', request)) return handleGetSettings(request);
	if (requestMatch('PATCH', '/auth/settings', request)) return handlePatchSettings(request);

	if (requestMatch('GET', '/auth/accounts', request)) return handleListAccounts(request);
	if (requestMatch('POST', '/auth/accounts', request)) return handleCreateAccount(request);

	const updateMatch = requestMatch('PATCH', '/auth/accounts/:id', request);
	if (updateMatch) return handleUpdateAccount(request, updateMatch.id);

	const deleteMatch = requestMatch('DELETE', '/auth/accounts/:id', request);
	if (deleteMatch) return handleDeleteAccount(request, deleteMatch.id);

	if (requestMatch('GET', '/auth/tokens', request)) return handleListTokens(request);
	if (requestMatch('POST', '/auth/tokens', request)) return handleCreateToken(request);

	const revokeMatch = requestMatch('DELETE', '/auth/tokens/:id', request);
	if (revokeMatch) return handleRevokeToken(request, revokeMatch.id);

	if (requestMatch('GET', '/auth/shares', request)) return handleListShares(request);
	if (requestMatch('POST', '/auth/shares', request)) return handleCreateShare(request);

	const revokeShareMatch = requestMatch('DELETE', '/auth/shares/:id', request);
	if (revokeShareMatch) return handleRevokeShare(request, revokeShareMatch.id);
};

// ── Admin-only: shared access tokens ──────────────────────────────────────────
// Share tokens grant time-limited, read-only, scoped access to farm records
// without requiring a login. The token is embedded in a URL.

const handleListShares = request => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	const shares = settingsDb.get('shareTokens') ?? [];
	return Response.json(shares.map(({ token: _, ...safe }) => safe));
};

const handleCreateShare = async request => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { name, purpose, collections, fieldIds, dateRange, expiresAt } = body;
	if (!name) return new Response('name required', { status: 400 });
	if (!collections?.length) return new Response('collections required', { status: 400 });

	const token = `share_${nanoid(40)}`;
	const id = nanoid(8);
	const record = {
		id,
		name,
		purpose: purpose ?? 'custom',
		collections,
		fieldIds: fieldIds ?? null,
		dateRange: dateRange ?? null,
		expiresAt: expiresAt ?? null,
		token,
		tokenPrefix: token.slice(0, 14),
		viewCount: 0,
		lastViewed: null,
		createdAt: new Date().toISOString(),
	};

	const existing = settingsDb.get('shareTokens') ?? [];
	await settingsDb.set('shareTokens', [...existing, record]);

	// Return the full token ONCE — it is never returned again after this
	return Response.json(
		{ id, name, purpose: record.purpose, token, tokenPrefix: record.tokenPrefix, createdAt: record.createdAt },
		{ status: 201 },
	);
};

const handleRevokeShare = async (request, id) => {
	const guard = requireRole(request, ['admin']);
	if (guard) return guard;

	const shares = settingsDb.get('shareTokens') ?? [];
	const filtered = shares.filter(s => s.id !== id);

	if (filtered.length === shares.length) return new Response(null, { status: 404 });

	await settingsDb.set('shareTokens', filtered);
	return new Response(null, { status: 204 });
};

export default authRouter;
