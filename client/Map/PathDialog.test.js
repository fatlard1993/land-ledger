import { afterEach, describe, expect, mock, test } from 'bun:test';

import PathDialog, { PATH_COLORS } from './PathDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe("a path's surface", () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const surfaceSelect = dialog =>
		[...dialog.elem.querySelectorAll('select')].find(select =>
			[...select.options].some(option => option.value === PATH_COLORS[0].value),
		);

	test('is picked from a Select of the surfaces, and saved as its color', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const path = { id: 'p1', name: 'North Lane', color: '#795548', geometry: null };
		const dialog = new PathDialog({ appendTo: document.body, path, onSave });

		await settle();

		const select = surfaceSelect(dialog);

		expect([...select.options].map(option => option.text)).toEqual(PATH_COLORS.map(({ label }) => label));
		expect(select.value).toBe('#795548');

		select.value = '#9E9E9E';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save').click();
		await settle();

		expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'North Lane', color: '#9E9E9E' });
	});
});
