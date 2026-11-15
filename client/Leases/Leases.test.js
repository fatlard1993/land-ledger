import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import Leases from './Leases.js';

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

describe("the Leases bar's Add", () => {
	let fetch;

	beforeEach(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	const barButtons = view => [...view.toolbar.elem.querySelectorAll('button')];
	const menuItems = () => [...document.querySelectorAll('[role="menuitem"]')];

	test('is the one filled button in the bar, and opens a menu of the kinds under it', async () => {
		const view = new Leases({ appendTo: document.body });

		const filled = barButtons(view).filter(button => !/variant-(flat|chip)/.test(button.className));

		expect(filled.map(button => button.textContent.trim())).toEqual(['Add']);

		filled[0].click();

		await waitFor(() => expect(view.addMenu.isOpen).toBe(true));
		expect(filled[0].getAttribute('aria-expanded')).toBe('true');
		expect(menuItems().map(item => item.textContent.trim())).toEqual([
			'Add a lease I pay',
			'Add a lease I receive',
			'Add a loan or mortgage',
		]);
	});

	test('a kind chosen from the menu opens the lease dialog for it', async () => {
		const view = new Leases({ appendTo: document.body });

		barButtons(view)
			.find(button => button.textContent.trim() === 'Add')
			.click();
		await waitFor(() => expect(view.addMenu.isOpen).toBe(true));

		menuItems()
			.find(item => item.textContent.trim() === 'Add a loan or mortgage')
			.click();

		await waitFor(() =>
			expect(
				[...document.querySelectorAll('dialog')].some(dialog => dialog.textContent.includes('Add Loan / Mortgage')),
			).toBe(true),
		);
		expect(view.addMenu.isOpen).toBe(false);
	});
});
