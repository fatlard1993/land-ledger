import { afterEach, describe, expect, mock, test } from 'bun:test';

import MaintenanceScheduleDialog from './MaintenanceScheduleDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

describe('a new maintenance schedule', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('fills its fields from the template picked, and saves them with its properties', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new MaintenanceScheduleDialog({
			appendTo: document.body,
			equipment: { id: 'e1', name: 'JD 8R', usageUnit: 'hrs' },
			onSave,
		});
		const { inputElements } = dialog.form;

		await settle();

		inputElements.template.elem.value = 'Fuel Filter';
		inputElements.template.elem.dispatchEvent(new Event('change', { bubbles: true }));

		expect(inputElements.name.elem.value).toBe('Fuel Filter');
		expect(inputElements.intervalUsage.elem.value).toBe('500');

		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save').click();
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			equipmentId: 'e1',
			name: 'Fuel Filter',
			procedure: 'Replace primary and secondary fuel filters.',
			intervalUsage: 500,
			intervalDays: null,
			lastDoneDate: null,
			lastDoneUsage: null,
			properties: {},
		});
	});
});
