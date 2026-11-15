import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import EventDialog from './EventDialog.js';

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

describe("an event's category", () => {
	let fetch;

	beforeEach(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async url =>
			String(url).startsWith('/fields')
				? Response.json({ f1: { id: 'f1', name: 'Creek Bottom', acreage: '40' } })
				: Response.json({}),
		);
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	const categorySelect = dialog =>
		[...dialog.elem.querySelectorAll('select')].find(select =>
			[...select.options].some(option => option.value === 'soil_test'),
		);

	test('is picked from a Select, and picking one rebuilds the details for it', async () => {
		const dialog = new EventDialog({ appendTo: document.body, fieldId: 'f1', onSave: () => {} });

		await waitFor(() => expect(categorySelect(dialog)).toBeTruthy());

		const select = categorySelect(dialog);

		expect(select.value).toBe('crop');
		expect(dialog.elem.textContent).not.toContain('Yield / Acre');

		select.value = 'harvest';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		await waitFor(() => expect(dialog.elem.textContent).toContain('Yield / Acre'));
		expect(dialog._collectData().category).toBe('harvest');
	});
});
