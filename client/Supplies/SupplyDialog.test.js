import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import SupplyDialog from './SupplyDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

const press = (dialog, label) =>
	[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

const type = (input, value) => {
	input.elem.value = value;
	input.elem.dispatchEvent(new Event('input', { bubbles: true }));
	input.elem.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('the supply dialog', () => {
	let fetch;

	beforeEach(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	test('guesses its emoji from the category, prices by markup on the cost, and saves the record', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new SupplyDialog({ appendTo: document.body, buildingId: 'b1', onSave });
		const { inputElements } = dialog.form;

		await settle();

		expect(inputElements.buildingId).toBeUndefined();

		type(inputElements.name, 'Ag Lime');
		type(inputElements.category, 'Lime');
		type(inputElements.costPerUnit, '40');
		type(inputElements.markup, '25');

		expect(inputElements.calculatedPrice.elem.value).toBe('$50.00');

		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			name: 'Ag Lime',
			category: 'Lime',
			unit: '',
			costPerUnit: '40',
			currentStock: '',
			emoji: '',
			buildingId: 'b1',
			priceMode: 'markup',
			markupPercent: 25,
			pricePerUnit: '',
			properties: {},
		});
		expect(inputElements.emojiShown.elem.value).not.toBe('📦');
	});

	test('a fixed price shows its own field in place of the markup', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new SupplyDialog({
			appendTo: document.body,
			supply: { name: 'Salt', priceMode: 'fixed', pricePerUnit: 9 },
			onSave,
		});
		const shown = key => dialog.form.inputElements[key].elem.closest('.Label').style.display !== 'none';

		await settle();

		expect(shown('fixedPrice')).toBe(true);
		expect(shown('markup')).toBe(false);

		press(dialog, '% Markup');

		expect(shown('fixedPrice')).toBe(false);
		expect(shown('markup')).toBe(true);
	});
});
