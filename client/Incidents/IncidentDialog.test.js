import { afterEach, describe, expect, mock, test } from 'bun:test';

import IncidentDialog from './IncidentDialog.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

const incident = { id: 'i1', date: '2026-05-02', type: 'Crop Damage — Hail', severity: 'minor', resolved: false };

const press = (dialog, label) =>
	[...dialog.elem.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();

describe("an incident report's buttons", () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('Delete and the way out come first, then the actions, Save last', async () => {
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave: () => {}, onDelete: () => {} });

		await settle();

		const order = [...dialog.elem.querySelectorAll('.footer button')].map(button => button.textContent.trim());

		expect(order).toEqual(['Delete', 'Cancel', 'Mark Resolved', 'Save']);
	});

	test('Save hands the record to onSave and closes', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave, onDelete: () => {} });

		await settle();
		press(dialog, 'Save');
		await settle();

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'Crop Damage — Hail', resolved: false });
		expect(dialog.elem.isConnected).toBe(false);
	});

	test('Mark Resolved saves it resolved', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave, onDelete: () => {} });

		await settle();
		press(dialog, 'Mark Resolved');
		await settle();

		expect(onSave.mock.calls[0][0]).toMatchObject({ resolved: true });
	});

	test("Mark Resolved's refusal shows on the failure line and keeps the dialog open", async () => {
		const onSave = mock(() => ({ status: 'error', response: { status: 409 }, body: { error: 'Already resolved' } }));
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave, onDelete: () => {} });

		await settle();
		press(dialog, 'Mark Resolved');
		await settle();

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(dialog.failure.elem.textContent).toBe('Already resolved');
		expect(dialog.elem.isConnected).toBe(true);
	});

	test('Delete asks first, then hands over to onDelete', async () => {
		const onDelete = mock(() => ({ status: 'success', body: {} }));
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave: () => {}, onDelete });

		await settle();
		press(dialog, 'Delete');
		await settle();

		const confirm = [...document.querySelectorAll('dialog')].find(elem => elem !== dialog.elem);

		expect(confirm.textContent).toContain('Delete this Crop Damage — Hail report?');

		[...confirm.querySelectorAll('button')].find(button => button.textContent.trim() === 'Delete').click();
		await settle();

		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	test('Cancel closes without saving', async () => {
		const onSave = mock();
		const dialog = new IncidentDialog({ appendTo: document.body, incident, onSave, onDelete: () => {} });

		await settle();
		press(dialog, 'Cancel');
		await settle();

		expect(onSave).not.toHaveBeenCalled();
		expect(dialog.elem.isConnected).toBe(false);
	});
});

describe("an incident report's own fields", () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const type = (input, value) => {
		input.elem.value = value;
		input.elem.dispatchEvent(new Event('input', { bubbles: true }));
		input.elem.dispatchEvent(new Event('change', { bubbles: true }));
	};

	test('are declared: the head lost per herd, the properties and the status the equipment is left in', async () => {
		const onSave = mock(() => ({ status: 'success', body: {} }));
		const livestockEvents = [{ id: 'ev1', name: 'Cattle (12)', details: { species: 'Cattle', headCount: 12 } }];
		const dialog = new IncidentDialog({
			appendTo: document.body,
			entityType: 'equipment',
			entity: { id: 'e1', name: 'Baler' },
			livestockEvents,
			onSave,
		});
		const { inputElements } = dialog.form;

		await settle();

		expect(dialog.elem.querySelector(`label[for="${inputElements.lost_ev1.elem.id}"]`).textContent).toBe(
			'Cattle (12 hd): lost',
		);

		type(inputElements.type, 'Livestock Injury');
		type(inputElements.lost_ev1, '2');
		inputElements.statusImpact.elem.value = 'out_of_service';
		inputElements.statusImpact.elem.dispatchEvent(new Event('change', { bubbles: true }));
		press(dialog, 'Save');
		await settle();

		expect(onSave.mock.calls[0][0]).toMatchObject({
			entityType: 'equipment',
			entityId: 'e1',
			livestockLosses: JSON.stringify([{ eventId: 'ev1', species: 'Cattle', lost: 2, injured: 0 }]),
			properties: { 'resolution notes': '' },
			entityStatusUpdate: 'out_of_service',
		});
	});
});
