import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setQueueOwner } from './offlineQueue';

const KEY = 'land-ledger-offline-queue';
const stored = key => JSON.parse(localStorage.getItem(key) || '[]');

const queueWhileOffline = async (url, body) => {
	const res = await window.fetch(url, { method: 'POST', body: JSON.stringify(body) });

	expect(res.status).toBe(202);
};

describe('the offline queue follows whoever is signed in', () => {
	beforeEach(() => {
		localStorage.clear();
		Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
		setQueueOwner({ enabled: false });
	});

	afterEach(() => {
		delete navigator.onLine;
		localStorage.clear();
		document.body.innerHTML = '';
	});

	test('writes queued with sign-in off go with the admin who turns it on', async () => {
		await queueWhileOffline('/fields', { name: 'North forty' });

		setQueueOwner({ enabled: true, id: 'admin', name: 'Admin', roles: { admin: true } });
		await queueWhileOffline('/events', { title: 'Planted' });

		expect(localStorage.getItem(KEY)).toBeNull();
		expect(stored(`${KEY}-admin`).map(entry => entry.url)).toEqual(['/fields', '/events']);
	});

	test('turning sign-in off gathers every account’s queue, oldest first', () => {
		localStorage.setItem(`${KEY}-admin`, JSON.stringify([{ url: '/fields', method: 'POST', timestamp: 3 }]));
		localStorage.setItem(`${KEY}-hand`, JSON.stringify([{ url: '/events', method: 'POST', timestamp: 1 }]));

		setQueueOwner({ enabled: false });

		expect(stored(KEY).map(entry => entry.url)).toEqual(['/events', '/fields']);
		expect(localStorage.getItem(`${KEY}-admin`)).toBeNull();
		expect(localStorage.getItem(`${KEY}-hand`)).toBeNull();
	});

	test('signing out leaves each account’s queue for its next sign-in', () => {
		localStorage.setItem(`${KEY}-admin`, JSON.stringify([{ url: '/fields', method: 'POST', timestamp: 1 }]));

		setQueueOwner(null);

		expect(stored(`${KEY}-admin`)).toHaveLength(1);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	test('another account does not take over someone else’s queue', () => {
		localStorage.setItem(`${KEY}-admin`, JSON.stringify([{ url: '/fields', method: 'POST', timestamp: 1 }]));

		setQueueOwner({ enabled: true, id: 'hand', name: 'Hand', roles: {} });

		expect(stored(`${KEY}-admin`)).toHaveLength(1);
		expect(localStorage.getItem(`${KEY}-hand`)).toBeNull();
	});
});
