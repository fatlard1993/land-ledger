import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { Form } from '@vanilla-bean/components';

import BudgetItemDialog from '../Budget/BudgetItemDialog.js';
import MaintenanceDialog from '../Equipment/MaintenanceDialog.js';
import FeedingScheduleDialog from '../Livestock/FeedingScheduleDialog.js';
import { PropertiesField } from './formFields.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

const type = (input, value) => {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('a properties field', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('holds its rows as an object, trimmed and without the unnamed ones, labelled as a group', () => {
		const form = new Form({
			appendTo: document.body,
			data: { props: { gate: 'locked', depth: 8 } },
			inputs: [{ key: 'props', label: 'Properties', InputComponent: PropertiesField }],
		});

		expect(form.options.data.props).toEqual({ gate: 'locked', depth: '8' });

		[...form.elem.querySelectorAll('button')].find(button => button.textContent.includes('Add property')).click();

		const names = form.elem.querySelectorAll('[aria-label="Property name"]');
		const values = form.elem.querySelectorAll('[aria-label="Property value"]');

		type(values[2], 'no name');
		type(names[0], ' latch ');
		type(values[0], ' chain ');

		expect(form.options.data.props).toEqual({ latch: 'chain', depth: '8' });
		expect(form.inputElements.props.elem.getAttribute('role')).toBe('group');
	});
});

describe('the dialogs that keep free properties', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const cases = [
		['a budget item', options => new BudgetItemDialog({ item: { name: 'Seed', amount: 5 }, ...options })],
		['a maintenance record', options => new MaintenanceDialog({ equipment: { id: 'e1' }, ...options })],
		['a feeding schedule', options => new FeedingScheduleDialog({ fieldId: 'f1', ...options })],
	];

	for (const [what, open] of cases) {
		test(`${what} declares them and saves them`, async () => {
			const fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
			const onSave = mock(() => ({ status: 'success', body: {} }));
			const dialog = open({ appendTo: document.body, onSave });

			await settle();

			const props = dialog.form.inputElements.props;

			[...props.elem.querySelectorAll('button')].find(button => button.textContent.includes('Add property')).click();
			type(props.elem.querySelector('[aria-label="Property name"]'), 'note');
			type(props.elem.querySelector('[aria-label="Property value"]'), 'kept');
			await dialog.save();

			expect(onSave.mock.calls[0][0].properties).toEqual({ note: 'kept' });

			fetch.mockRestore();
		});
	}
});
