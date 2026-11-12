import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { openRevenueDialog } from './EntityRevenue.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

const buttonNamed = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);

describe('an income record', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('without an amount says so on the failure line, unsaved and not reported as a bug', async () => {
		const reportError = spyOn(globalThis, 'reportError').mockImplementation(() => {});
		const onSave = mock();

		openRevenueDialog('building', { id: 'b1', name: 'Barn' }, { id: 'r1' }, onSave, null);
		await settle();

		buttonNamed('Save').click();
		await settle();

		const dialog = document.querySelector('dialog');

		expect(dialog.querySelector('.failure').textContent).toBe('Enter an amount');
		expect(dialog.isConnected).toBe(true);
		expect(onSave).not.toHaveBeenCalled();
		expect(reportError).not.toHaveBeenCalled();

		reportError.mockRestore();
	});
});
