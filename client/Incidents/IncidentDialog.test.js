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
