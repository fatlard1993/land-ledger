import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { openQuickLog } from './QuickLog.js';

// Retries an assertion until it holds, or fails with its last error once the time is up
const waitFor = async (assertion, { timeout = 1000 } = {}) => {
	const end = Date.now() + timeout;

	for (;;) {
		try {
			return assertion();
		} catch (error) {
			if (Date.now() > end) throw error;
			await new Promise(resolve => setTimeout(resolve, 20));
		}
	}
};

// happy-dom has no Option constructor; the quick log builds its location and unit choices with one
globalThis.Option ??= function Option(text = '', value = text) {
	return Object.assign(document.createElement('option'), { text, value });
};

const sheetInPage = () => document.querySelector('dialog.quick-log');
const buttonNamed = text =>
	[...sheetInPage().querySelectorAll('button')].find(button => button.textContent.includes(text));

describe('the quick log sheet', () => {
	let fetch;

	beforeEach(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
	});
	afterEach(() => {
		fetch.mockRestore();
		document.querySelectorAll('dialog.quick-log').forEach(dialog => dialog.remove());
	});

	test('is gone from the page once it is dismissed', async () => {
		openQuickLog();
		await waitFor(() => expect(sheetInPage()?.open).toBe(true));

		sheetInPage().close();

		await waitFor(() => expect(sheetInPage()).toBeNull());
	});

	test('shows Logged for a moment after a save, then is gone from the page', async () => {
		openQuickLog();
		await waitFor(() => expect(sheetInPage()?.open).toBe(true));

		buttonNamed('Quick note').click();
		const note = sheetInPage().querySelector('textarea');

		note.value = 'Fence down on the north line';
		note.dispatchEvent(new Event('input'));
		buttonNamed('Log it').click();

		await waitFor(() => expect(buttonNamed('Logged')).toBeTruthy());
		expect(sheetInPage().open).toBe(true);

		await waitFor(() => expect(sheetInPage()).toBeNull(), { timeout: 2000 });
	});

	test('a second open replaces the first, leaving one sheet open', async () => {
		openQuickLog();
		const first = sheetInPage();

		openQuickLog();
		await waitFor(() => expect(document.querySelectorAll('dialog.quick-log')).toHaveLength(1));

		expect(sheetInPage()).not.toBe(first);
		expect(sheetInPage().open).toBe(true);
	});
});

describe("the quick log's categories", () => {
	let posts;
	let fetch;

	beforeEach(() => {
		posts = [];
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method = 'GET', body } = {}) => {
			if (method === 'POST') posts.push({ url: String(url), body: JSON.parse(body) });

			return new Response('{}');
		});
	});
	afterEach(() => {
		fetch.mockRestore();
		document.querySelectorAll('dialog.quick-log').forEach(dialog => dialog.remove());
	});

	// The location comes first, then the category
	const categorySelect = () => sheetInPage().querySelectorAll('select')[1];
	const pick = (select, value) => {
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	};

	test("a field event's type is picked from a Select of the event categories", async () => {
		openQuickLog();
		await waitFor(() => expect(sheetInPage()?.open).toBe(true));

		buttonNamed('Field event').click();

		const select = categorySelect();

		expect([...select.options].map(option => option.value)).toContain('soil_test');
		expect(select.value).toBe('crop');

		pick(select, 'soil_test');
		buttonNamed('Log it').click();

		await waitFor(() => expect(posts).toHaveLength(1));
		expect(posts[0].body.category).toBe('soil_test');
	});

	test("an application's category is picked from a Select", async () => {
		openQuickLog();
		await waitFor(() => expect(sheetInPage()?.open).toBe(true));

		buttonNamed('Application').click();

		const select = categorySelect();

		expect(select.value).toBe('herbicide');

		pick(select, 'fungicide');

		const product = sheetInPage().querySelector('input[placeholder="e.g. Roundup PowerMAX"]');

		product.value = 'Headline';
		product.dispatchEvent(new Event('input'));
		buttonNamed('Log it').click();

		await waitFor(() => expect(posts).toHaveLength(1));
		expect(posts[0].body).toMatchObject({ category: 'fungicide', product: 'Headline' });
	});
});
