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
		buttonNamed('Log It').click();

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
