import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import context from '../context';
import AccountsDialog from './AccountsDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

// The server as it is with sign-in off: every route answers, and /auth/me says so until sign-in is on
const serve = ({ loginOk = true } = {}) => {
	const calls = [];
	let enabled = false;

	const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET', body } = {}) => {
		calls.push(`${method} ${url}`);

		if (url === '/auth/settings' && method === 'PATCH') enabled = JSON.parse(body).authEnabled;
		if (url === '/auth/settings') return Response.json({ authEnabled: enabled, adminPasskeyIsDefault: true });
		if (url === '/auth/accounts') return Response.json([{ id: 'admin', name: 'Admin', roles: { admin: true } }]);
		if (url === '/auth/accounts/admin') return Response.json({ id: 'admin', name: 'Admin', roles: { admin: true } });
		if (url === '/auth/login') return new Response(null, { status: loginOk ? 204 : 401 });
		if (url === '/auth/me')
			return Response.json(enabled ? { enabled, id: 'admin', name: 'Admin', roles: { admin: true } } : { enabled });

		if (url === '/auth/tokens' || url === '/auth/shares') return Response.json([]);

		return Response.json({});
	});

	return { calls, fetch };
};

const turnOn = async (passkey, again = passkey) => {
	const dialog = new AccountsDialog({ appendTo: document.body });

	await settle();

	const [first, second] = dialog.body.elem.querySelectorAll('input[type=password]');

	first.value = passkey;
	second.value = again;
	[...dialog.body.elem.querySelectorAll('button')].find(b => b.textContent.includes('Turn on sign-in')).click();
	await settle();

	return dialog;
};

describe('turning sign-in on from the Admin panel', () => {
	let server;

	afterEach(() => {
		server.fetch.mockRestore();
		context.currentUser = null;
		document.body.innerHTML = '';
	});

	test('sets the admin passkey, signs in with it, then turns sign-in on', async () => {
		server = serve();

		const dialog = await turnOn('north-forty');
		const writes = server.calls.filter(call => !call.startsWith('GET'));

		expect(writes).toEqual(['PATCH /auth/accounts/admin', 'POST /auth/login', 'PATCH /auth/settings']);
		expect(context.currentUser?.id).toBe('admin');
		expect(dialog.body.elem.textContent).toContain('Sign-in is on');
	});

	test('a passkey that will not sign in leaves sign-in off', async () => {
		server = serve({ loginOk: false });

		await turnOn('north-forty');

		expect(server.calls).not.toContain('PATCH /auth/settings');
		expect(context.currentUser).toBeNull();
	});

	test('passkeys that differ change nothing', async () => {
		server = serve();

		await turnOn('north-forty', 'north-40');

		expect(server.calls.filter(call => !call.startsWith('GET'))).toEqual([]);
	});
});
