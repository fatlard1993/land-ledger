import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { openRevenueDialog, openSellDialog } from './EntityRevenue.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

const buttonNamed = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);

describe('an income record', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('without an amount says so under the amount, unsaved and not reported as a bug', async () => {
		const reportError = spyOn(globalThis, 'reportError').mockImplementation(() => {});
		const onSave = mock();

		openRevenueDialog('building', { id: 'b1', name: 'Barn' }, { id: 'r1' }, onSave, null);
		await settle();

		buttonNamed('Save').click();
		await settle();

		const dialog = document.querySelector('dialog');

		const amount = [...dialog.querySelectorAll('label')].find(
			label => label.textContent === 'Amount ($)',
		).parentElement;

		expect(amount.querySelector('.vbc-field-error').textContent).toBe('Enter an amount');
		expect(dialog.querySelector('.failure').textContent).toBe('');
		expect(dialog.isConnected).toBe(true);
		expect(onSave).not.toHaveBeenCalled();
		expect(reportError).not.toHaveBeenCalled();

		reportError.mockRestore();
	});

	test('saves its fields, and fills the amount from the inventory it sold', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));

		openRevenueDialog(
			'building',
			{ id: 'b1', name: 'Barn' },
			{
				id: 'r1',
				type: 'Rental',
				amount: 250,
				date: '2026-10-02',
				description: 'Wedding',
				properties: { guests: '80' },
			},
			onSave,
			null,
		);
		await settle();

		buttonNamed('Save').click();
		await settle();

		expect(onSave.mock.calls[0][0]).toEqual({
			entityType: 'building',
			entityId: 'b1',
			entityName: 'Barn',
			date: '2026-10-02',
			amount: 250,
			type: 'Rental',
			description: 'Wedding',
			properties: { guests: '80' },
		});
	});
});

describe('a sale', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('without a price says so under the price, and with one records the sale', async () => {
		const createRevenue = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ id: 'rev1' }));
		const hide = mock();

		openSellDialog('equipment', { id: 'e1', name: 'Old baler' }, () => {}, hide);
		await settle();

		buttonNamed('Record sale & remove').click();
		await settle();

		const dialog = document.querySelector('dialog');
		const price = [...dialog.querySelectorAll('label')].find(label => label.textContent === 'Sale Price ($)');
		const input = document.getElementById(price.htmlFor);

		expect(price.parentElement.querySelector('.vbc-field-error').textContent).toBe('Enter the sale price');
		expect(createRevenue).not.toHaveBeenCalled();

		input.value = '1200';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		buttonNamed('Record sale & remove').click();
		await settle();

		const body = JSON.parse(createRevenue.mock.calls[0][1].body);

		expect(body).toMatchObject({ entityType: 'equipment', entityId: 'e1', amount: 1200, type: 'sale', notes: '' });
		expect(hide).toHaveBeenCalled();

		createRevenue.mockRestore();
	});
});
