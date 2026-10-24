import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { updateField } from './api/fields.js';
import { showConflictDialog } from './ConflictDialog.js';

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
	[...document.querySelectorAll('dialog')].find(elem => elem.textContent.includes('Changed Since You Opened It'));

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

	test('a field blank on one side and missing on the other is no conflict, and is sent without asking', async () => {
		server = serve();

		const pending = updateField('f1', { body: { name: 'South Forty', notes: '', _v: 2 } });

		await settle();
		press(conflictDialog(), 'Apply');
		await pending;

		expect(server.patches[0]).toEqual({ name: 'South Forty', notes: '', _v: 2 });
		expect(server.patches.at(-1)).toEqual({ name: 'South Forty', notes: '', _v: 3 });

		const quiet = updateField('f1', { body: { notes: '', _v: 2 } });

		await settle();

		expect(conflictDialog()).toBeUndefined();
		expect((await quiet).status).toBe('success');
		expect(server.patches.at(-1)).toEqual({ notes: '', _v: 3 });
	});

	test('the dialog lists only the fields that differ', async () => {
		server = serve();

		const pending = updateField('f1', { body: { name: 'South Forty', notes: '', _v: 2 } });

		await settle();

		const rows = [...conflictDialog().querySelectorAll('.key')].map(key => key.textContent);

		expect(rows).toEqual(['Name']);

		press(conflictDialog(), 'Cancel');
		await pending;
	});
});

describe('queued changes', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('keep the offline wording', async () => {
		const pending = showConflictDialog([
			{
				entry: { timestamp: 1, url: '/fields/f1', body: JSON.stringify({ name: 'South Forty' }) },
				current: stored,
				conflictingFields: [{ key: 'name', ourValue: 'South Forty', serverValue: 'North Forty' }],
			},
		]);
		const dialog = [...document.querySelectorAll('dialog')].find(elem => elem.textContent.includes('Sync Conflicts'));

		expect(dialog.textContent).toContain('while you were offline');

		press(dialog, 'Cancel');

		expect(await pending).toBeNull();
	});

	test('with nothing left to choose resolve to the queued change, unasked', async () => {
		const entry = { timestamp: 1, url: '/fields/f1', body: JSON.stringify({ notes: '' }) };

		expect(
			await showConflictDialog([
				{ entry, current: stored, conflictingFields: [{ key: 'notes', ourValue: '', serverValue: undefined }] },
			]),
		).toEqual([{ entry, body: entry.body }]);
		expect(document.querySelector('dialog')).toBeNull();
	});
});
