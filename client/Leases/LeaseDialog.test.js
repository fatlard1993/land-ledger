import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { getBuildings, getEquipment, getFields } from '../api';
import LeaseDialog from './LeaseDialog.js';

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

const LISTS = {
	'/fields': { f1: { id: 'f1', name: 'Creek Bottom' }, f2: { id: 'f2', name: 'Home Forty' } },
	'/buildings': { b1: { id: 'b1', name: 'Hay barn' } },
	'/equipment': {},
};

const press = (dialog, label) =>
	[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

const type = (input, value) => {
	input.elem.value = value;
	input.elem.dispatchEvent(new Event('input', { bubbles: true }));
	input.elem.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('the lease dialog', () => {
	let fetch;

	beforeEach(async () => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async url => Response.json(LISTS[String(url)] ?? {}));
		// A list another test read is kept; read afresh, it's this test's
		for (const list of [getFields, getBuildings, getEquipment]) (await list()).invalidateCache?.();
	});
	afterEach(() => {
		fetch.mockRestore();
		document.body.innerHTML = '';
	});

	test('saves a lease I receive rent on, for the building picked, at a crop share', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new LeaseDialog({ appendTo: document.body, role: 'lessor', onSave });
		const { inputElements } = dialog.form;

		await waitFor(() => expect(inputElements.lessorBuilding.elem.value).toBe('b1'));

		inputElements.assetType.elem.value = 'building';
		inputElements.assetType.elem.dispatchEvent(new Event('change', { bubbles: true }));
		type(inputElements.tenantName, 'Dale');
		inputElements.lessorRateType.elem.value = 'crop_share';
		inputElements.lessorRateType.elem.dispatchEvent(new Event('change', { bubbles: true }));
		type(inputElements.cropSharePercent, '40');
		type(inputElements.leaseStart, '2026-03-01');

		// The dates keep their row of three once the fields round them have changed
		expect(inputElements.leaseStart.elem.parentElement.parentElement.style.display).toBe('grid');

		press(dialog, 'Save');
		await waitFor(() => expect(onSave).toHaveBeenCalled());

		expect(onSave.mock.calls[0][0]).toEqual({
			role: 'lessor',
			entityType: 'building',
			entityId: 'b1',
			entityName: 'Hay barn',
			tenantName: 'Dale',
			type: 'crop_share',
			rateAmount: null,
			cropSharePercent: 40,
			startDate: '2026-03-01',
			endDate: '',
			renewalDate: '',
			paymentTerms: '',
			properties: {},
		});
	});

	test("a loan's payment and maturity follow its terms until they're typed", async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new LeaseDialog({ appendTo: document.body, role: 'tenant', onSave });
		const { inputElements } = dialog.form;

		press(dialog, 'Loan / Mortgage');
		type(inputElements.lender, 'Farm Credit');
		type(inputElements.loanStart, '2026-01-15');
		type(inputElements.loanAmount, '120000');
		type(inputElements.interestRate, '6');
		type(inputElements.termYears, '10');

		expect(inputElements.monthlyPayment.elem.value).toBe('1332.25');
		expect(inputElements.maturityDate.elem.value).toBe('2036-01-15');
		expect(dialog.elem.textContent).toContain('Calculated payment: $1,332.25/mo');

		press(dialog, 'Save');
		await waitFor(() => expect(onSave).toHaveBeenCalled());

		expect(onSave.mock.calls[0][0]).toEqual({
			role: 'loan',
			entityType: '',
			entityId: '',
			entityName: '',
			lender: 'Farm Credit',
			loanNumber: '',
			loanAmount: 120000,
			interestRate: 6,
			termYears: 10,
			monthlyPayment: 1332.25,
			currentBalance: null,
			escrow: false,
			assetAppraisalValue: null,
			startDate: '2026-01-15',
			maturityDate: '2036-01-15',
			properties: {},
		});
	});

	test('an edited loan keeps the asset it is for', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const lease = {
			id: 'l1',
			role: 'loan',
			lender: 'Farm Credit',
			entityType: 'building',
			entityId: 'b1',
			entityName: 'Hay barn',
		};
		const dialog = new LeaseDialog({ appendTo: document.body, lease, onSave });

		press(dialog, 'Save');
		await waitFor(() => expect(onSave).toHaveBeenCalled());

		expect(onSave.mock.calls[0][0]).toMatchObject({ entityType: 'building', entityId: 'b1', entityName: 'Hay barn' });
	});
});
