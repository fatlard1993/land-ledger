export const getMe = async () => {
	const res = await fetch('/auth/me');

	if (res.status === 401) return null;
	if (!res.ok) return null;

	return res.json();
};

export const logout = async () => {
	await fetch('/auth/logout', { method: 'POST' });
};

export const getAuthSettings = async () => {
	const res = await fetch('/auth/settings');

	return res.ok ? res.json() : null;
};

export const setAuthEnabled = async enabled => {
	const res = await fetch('/auth/settings', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ authEnabled: enabled }),
	});

	return res.ok;
};

export const getAccounts = async () => {
	const res = await fetch('/auth/accounts');

	return res.ok ? res.json() : [];
};

export const createAccount = async ({ name, passkey, roles }) => {
	const res = await fetch('/auth/accounts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, passkey, roles }),
	});

	if (!res.ok) throw new Error(await res.text());

	return res.json();
};

export const updateAccount = async (id, updates) => {
	const res = await fetch(`/auth/accounts/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates),
	});

	if (!res.ok) throw new Error(await res.text());

	return res.json();
};

export const deleteAccount = async id => {
	const res = await fetch(`/auth/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });

	if (!res.ok) throw new Error(await res.text());
};
