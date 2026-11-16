import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { getFields } from '../api';
import EventDialog from './EventDialog.js';

// Retries an assertion until it holds, or fails with its last error once the time is up
const waitFor = async (assertion, { timeout = 3000 } = {}) => {
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

	// A field shows when neither its own wrapper nor a group round it is hidden
	const shown = (dialog, text) => {
		const label = [...dialog.elem.querySelectorAll('label')].find(l => l.textContent === text);

		for (let elem = label?.parentElement; elem && elem !== dialog.elem; elem = elem.parentElement) {
			if (elem.style.display === 'none') return false;
		}

		return !!label;
	};

	test('is picked from a Select, and picking one shows the details for it', async () => {
		const dialog = new EventDialog({ appendTo: document.body, fieldId: 'f1', onSave: () => {} });

		await waitFor(() => expect(categorySelect(dialog)).toBeTruthy());

		const select = categorySelect(dialog);

		expect(select.value).toBe('crop');
		expect(shown(dialog, 'Yield / Acre')).toBe(false);
		expect(shown(dialog, 'Crop')).toBe(true);

		select.value = 'harvest';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		await waitFor(() => expect(shown(dialog, 'Yield / Acre')).toBe(true));
		expect(shown(dialog, 'Crop')).toBe(false);
		expect(dialog._collectData().category).toBe('harvest');
	});
});

describe('the event dialog', () => {
	let fetch;

	beforeEach(async () => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async url =>
			String(url).startsWith('/fields')
				? Response.json({ f1: { id: 'f1', name: 'Creek Bottom', acreage: '40' } })
				: Response.json({}),
		);
		// A list another test read is kept; read afresh, it's this test's
		(await getFields()).invalidateCache?.();
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	const press = (dialog, label) =>
		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

	const type = (input, value) => {
		input.elem.value = value;
		input.elem.dispatchEvent(new Event('input', { bubbles: true }));
		input.elem.dispatchEvent(new Event('change', { bubbles: true }));
	};

	const errorOf = input => input.elem.parentElement.querySelector('.vbc-field-error')?.textContent;

	test('says under the date that one is needed, rather than on the dialog', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new EventDialog({ appendTo: document.body, fieldId: 'f1', onSave });

		await waitFor(() => expect(dialog.form.inputElements.fieldId.elem.value).toBe('f1'));
		type(dialog.form.inputElements.date, '');
		press(dialog, 'Save');
		await waitFor(() => expect(errorOf(dialog.form.inputElements.date)).toBe('Choose a date'));

		expect(onSave).not.toHaveBeenCalled();
		expect(dialog.failure.elem.textContent).toBe('');
	});

	test('a harvest saves its details, its revenue quantity × price, and guesses its emoji from the output', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new EventDialog({ appendTo: document.body, fieldId: 'f1', onSave });
		const { inputElements } = dialog.form;

		await waitFor(() => expect(dialog.form.inputElements.fieldId.elem.value).toBe('f1'));

		inputElements.category.elem.value = 'harvest';
		inputElements.category.elem.dispatchEvent(new Event('change', { bubbles: true }));
		type(inputElements.date, '2026-09-20');
		type(inputElements.harvestOutput, 'Eggs');
		type(inputElements.harvestQty, '30');
		type(inputElements.harvestUnit, 'dozen');
		type(inputElements.harvestPrice, '4');

		expect(inputElements.emoji.elem.value).toBe('🥚');
		expect(inputElements.harvestYieldUnit.elem.value).toBe('dozen');
		expect(inputElements.harvestRevenue.elem.placeholder).toBe('$120.00');

		press(dialog, 'Save');
		await waitFor(() => expect(onSave).toHaveBeenCalled());

		expect(onSave.mock.calls[0][0]).toEqual({
			fieldId: 'f1',
			date: '2026-09-20',
			season: 2026,
			category: 'harvest',
			name: 'Eggs',
			emoji: '',
			details: {
				outputType: 'Eggs',
				yieldPerAcre: null,
				yieldUnit: 'dozen',
				quantity: 30,
				unit: 'dozen',
				pricePerUnit: 4,
				revenue: 120,
			},
			notes: '',
		});
	});

	test("a cover crop's mix saves the species named, each with its rate", async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const event = {
			id: 'e1',
			fieldId: 'f1',
			date: '2026-10-01',
			category: 'cover_crop',
			details: {
				species: [
					{ name: 'Cereal Rye', rate: 60 },
					{ name: '', rate: 5, unit: 'lbs/ac' },
				],
				outcomeNotes: 'thick',
			},
		};
		const dialog = new EventDialog({ appendTo: document.body, event, onSave });

		await waitFor(() => expect(dialog.form.inputElements.fieldId.elem.value).toBe('f1'));
		press(dialog, 'Save');
		await waitFor(() => expect(onSave).toHaveBeenCalled());

		expect(onSave.mock.calls[0][0]).toMatchObject({
			category: 'cover_crop',
			name: 'Cereal Rye',
			details: {
				species: [{ name: 'Cereal Rye', rate: 60, unit: 'lbs/ac' }],
				seedingMethod: 'drilled',
				terminationMethod: 'roller_crimper',
				seedCostPerAcre: null,
				applicationCostPerAcre: null,
				estimatedBiomass: '',
				nCreditLbs: '',
				outcomeNotes: 'thick',
			},
		});
	});
});
