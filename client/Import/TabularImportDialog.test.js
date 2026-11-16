import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import TabularImportDialog from './TabularImportDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

describe('the tabular import', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const label = (dialog, text) => [...dialog.elem.querySelectorAll('label')].find(each => each.textContent === text);
	const press = (dialog, text) =>
		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === text).click();

	test('maps the columns into the collection picked from a labelled field', async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json([]));
		const dialog = new TabularImportDialog({ appendTo: document.body, initialCollection: 'events' });

		dialog._columns = ['Product', 'Rate'];
		dialog._rows = [{ Product: 'Headline', Rate: '6' }];
		dialog._buildMapping();
		await dialog._renderMapper();

		const into = document.getElementById(label(dialog, 'Import into').htmlFor);

		into.value = 'supplies';
		into.dispatchEvent(new Event('change', { bubbles: true }));

		expect(dialog._collection).toBe('supplies');
		expect(dialog.elem.querySelector('[aria-label="Import Product as"]')).not.toBeNull();

		fetch.mockRestore();
	});

	test("a template that won't save says so in its form and stays open; one without a name says so under it", async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(
			async () => new Response('That name is taken', { status: 409 }),
		);
		const dialog = new TabularImportDialog({ appendTo: document.body });

		dialog._renderSaveTemplate();
		press(dialog, 'Save template');
		await settle();

		expect(label(dialog, 'Template name').parentElement.querySelector('.vbc-field-error')?.textContent).toBe(
			'Name the template',
		);
		expect(fetch).not.toHaveBeenCalled();

		const name = document.getElementById(label(dialog, 'Template name').htmlFor);

		name.value = 'Waypoint';
		name.dispatchEvent(new Event('input'));
		press(dialog, 'Save template');
		await settle();

		expect(dialog.elem.querySelector('[role=alert]').textContent).toBe(
			'Could not save the template: That name is taken',
		);
		expect(dialog.elem.isConnected).toBe(true);

		fetch.mockRestore();
	});
});
