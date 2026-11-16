import { afterEach, describe, expect, mock, test } from 'bun:test';

import BuildingDialog, { buildingEmoji } from './BuildingDialog.js';
import EquipmentDialog from './EquipmentDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

const press = (dialog, label) =>
	[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

const type = (input, value) => {
	input.elem.value = value;
	input.elem.dispatchEvent(new Event('input', { bubbles: true }));
	input.elem.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('the building and equipment dialogs', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test("a building's emoji follows its type, and is saved only once it's typed", async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const geometry = { type: 'Point', coordinates: [-97, 38] };
		const dialog = new BuildingDialog({ appendTo: document.body, geometry, onSave });
		const { inputElements } = dialog.form;

		await settle();

		type(inputElements.name, 'North Barn');
		type(inputElements.type, 'Hay barn');

		expect(inputElements.emojiShown.elem.value).toBe(buildingEmoji('Hay barn'));

		inputElements.labelShown.elem.click();
		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			name: 'North Barn',
			type: 'Hay barn',
			status: '',
			emoji: '',
			showLabel: false,
			properties: {},
			geometry,
		});
	});

	test('equipment saves its fields, its place and the emoji typed', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new EquipmentDialog({ appendTo: document.body, lat: 38, lng: -97, onSave });
		const { inputElements } = dialog.form;

		await settle();

		type(inputElements.name, 'Old baler');
		type(inputElements.emojiShown, '🦆');
		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toMatchObject({
			name: 'Old baler',
			tenure: 'own',
			size: 'med',
			emoji: '🦆',
			showLabel: true,
			properties: {},
			lat: 38,
			lng: -97,
		});
	});
});
