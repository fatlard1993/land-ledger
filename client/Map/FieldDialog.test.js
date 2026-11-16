import { afterEach, describe, expect, mock, test } from 'bun:test';

import FieldDialog from './FieldDialog.js';
import ParcelDialog from './ParcelDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

const press = (dialog, label) =>
	[...dialog.elem.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.title === label).click();

// About 40 acres, a quarter-mile square
const geometry = {
	type: 'Polygon',
	coordinates: [
		[
			[-97.01, 38.01],
			[-97.0, 38.01],
			[-97.0, 38.0],
			[-97.01, 38.0],
			[-97.01, 38.01],
		],
	],
};

describe('the field dialog', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test("labels the area's size, measures it from the boundary in the unit picked, and saves the field", async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new FieldDialog({ appendTo: document.body, geometry, acreage: '10', prefillName: 'North', onSave });
		const area = dialog.form.inputElements.area;
		const size = area.labelTarget.elem;

		await settle();

		expect(dialog.elem.querySelector(`label[for="${size.id}"]`).textContent).toBe('Area');

		const unit = area.elem.querySelector('select');

		unit.value = 'ha';
		unit.dispatchEvent(new Event('change', { bubbles: true }));
		press(dialog, 'Calculate from boundary');

		expect(Number(size.value)).toBeGreaterThan(10);

		press(dialog, 'Save');
		await settle();

		const saved = onSave.mock.calls[0][0];

		expect({ ...saved, acreage: Number(saved.acreage) > 10 }).toEqual({
			name: 'North',
			tenure: 'own',
			acreage: true,
			acreageUnit: 'ha',
			showLabel: true,
			status: '',
			trialGroup: '',
			trialRole: '',
			properties: {},
			geometry,
		});
	});
});

describe('the property line dialog', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('saves its area as estimated until one is typed, with the label toggle off once unticked', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new ParcelDialog({ appendTo: document.body, geometry, acreage: '39.5', onSave });

		await settle();

		dialog.form.inputElements.labelShown.elem.click();
		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			name: '',
			parcelId: '',
			owner: '',
			acreage: '39.5',
			acreageUnit: 'ac',
			status: '',
			showLabel: false,
			properties: {},
			geometry,
		});
	});
});
