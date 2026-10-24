import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { updateField } from './api/fields.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

const stored = { id: 'f1', name: 'North Forty', acreage: 40, _v: 3 };

// A server whose record moved on to _v 3: a PATCH carrying an older _v answers 409 with the stored record
const serve = () => {
	const patches = [];

	const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET', body } = {}) => {
		if (method !== 'PATCH') return Response.json({});

		const sent = JSON.parse(body);

		patches.push(sent);

		if (sent._v !== stored._v)
			return Response.json({ error: 'Changed elsewhere', _conflict: true, current: stored }, { status: 409 });

		return Response.json({ ...stored, ...sent, _v: stored._v + 1 });
	});

	return { fetch, patches };
};

const conflictDialog = () =>
	[...document.querySelectorAll('dialog')].find(elem => elem.textContent.includes('Sync Conflicts'));

const press = (root, label) =>
	[...root.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

describe('a stale update', () => {
	let server;

	afterEach(() => {
		server.fetch.mockRestore();
		document.body.innerHTML = '';
	});

	test('asks which value to keep and sends the choice over the stored version', async () => {
		server = serve();

		const pending = updateField('f1', { body: { name: 'South Forty', acreage: 40, _v: 2 } });

		await settle();

		const dialog = conflictDialog();

		expect(dialog.textContent).toContain('South Forty');
		expect(dialog.textContent).toContain('North Forty');

		press(dialog, 'Apply');

		const result = await pending;

		expect(server.patches.at(-1)).toEqual({ name: 'South Forty', acreage: 40, _v: 3 });
		expect(result.status).toBe('success');
		expect(result.body.name).toBe('South Forty');
	});

	test("keeping the server's value sends nothing of ours", async () => {
		server = serve();

		const pending = updateField('f1', { body: { name: 'South Forty', _v: 2 } });

		await settle();
		press(conflictDialog(), "Server's");
		press(conflictDialog(), 'Apply');

		const result = await pending;

		expect(server.patches.at(-1)).toEqual({ _v: 3 });
		expect(result.body.name).toBe('North Forty');
	});

	test('cancelling leaves the conflict with the caller', async () => {
		server = serve();

		const pending = updateField('f1', { body: { name: 'South Forty', _v: 2 } });

		await settle();
		press(conflictDialog(), 'Cancel');

		const result = await pending;

		expect(server.patches).toHaveLength(1);
		expect(result.conflict.fields).toEqual([{ key: 'name', ours: 'South Forty', theirs: 'North Forty' }]);
	});
});
