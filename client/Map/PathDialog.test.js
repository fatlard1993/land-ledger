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

describe('the path dialog', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const press = (dialog, label) =>
		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

	const type = (input, value) => {
		input.elem.value = value;
		input.elem.dispatchEvent(new Event('input', { bubbles: true }));
		input.elem.dispatchEvent(new Event('change', { bubbles: true }));
	};

	test('declares its fields, each with its label', async () => {
		const dialog = new PathDialog({ appendTo: document.body, onSave: () => {} });

		await settle();

		const { inputElements } = dialog.form;

		expect(Object.keys(inputElements)).toEqual([
			'emoji',
			'name',
			'type',
			'widthFt',
			'color',
			'properties',
			'status',
			'showLabel',
		]);
		expect(dialog.elem.querySelector(`label[for="${inputElements.name.elem.id}"]`).textContent).toBe('Name');
	});

	test("guesses the emoji from the type until one is typed, and saves only one that isn't the guess", async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const geometry = { type: 'LineString', coordinates: [] };
		const dialog = new PathDialog({ appendTo: document.body, geometry, onSave });

		await settle();

		const { inputElements } = dialog.form;

		type(inputElements.name, 'Lower drive');
		type(inputElements.type, 'Driveway');
		expect(inputElements.emoji.elem.value).toBe('🚗');

		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			name: 'Lower drive',
			type: 'Driveway',
			widthFt: '10',
			color: PATH_COLORS[0].value,
			emoji: '',
			status: '',
			showLabel: false,
			properties: {},
			geometry,
		});

		const second = new PathDialog({ appendTo: document.body, geometry, onSave });

		await settle();
		type(second.form.inputElements.emoji, '🦆');
		type(second.form.inputElements.type, 'Driveway');
		expect(second.form.inputElements.emoji.elem.value).toBe('🦆');
		press(second, 'Save');
		await settle();

		expect(onSave.mock.calls[1][0].emoji).toBe('🦆');
	});
});
