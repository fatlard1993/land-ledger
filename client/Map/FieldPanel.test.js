import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { Component } from '@vanilla-bean/components';

import FieldPanel from './FieldPanel.js';

// Chicago, where a date-only value read as UTC midnight lands on the evening before
describe('FieldPanel, west of Greenwich', () => {
	const zone = process.env.TZ;

	beforeAll(() => (process.env.TZ = 'America/Chicago'));
	afterAll(() => (zone === undefined ? delete process.env.TZ : (process.env.TZ = zone)));

	test('an event shows the day it was logged for', async () => {
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
		const panel = new FieldPanel();
		const field = { id: 'f1', name: 'Creek Bottom' };

		panel._content = new Component({ appendTo: document.body });
		panel._passedEvents = [
			{ id: 'e1', fieldId: 'f1', date: '2026-05-02', season: 2026, category: 'crop', name: 'Planted soybeans' },
			{ id: 'e2', fieldId: 'f1', date: '2026-01-01', category: 'observation', name: 'Walked the drainage' },
		];

		await panel._renderDetails(field);

		const dates = [...panel._content.elem.querySelectorAll('.date')].map(el => el.textContent);

		expect(dates).toContain(new Date(2026, 4, 2).toLocaleDateString());
		expect(dates).toContain(new Date(2026, 0, 1).toLocaleDateString());
		expect(panel._content.elem.textContent).not.toContain('2025');

		panel._content.elem.remove();
		fetch.mockRestore();
	});
});

describe("the panel's Edit", () => {
	let fetch;

	const settle = () => new Promise(resolve => setTimeout(resolve, 50));
	const openDialog = () => [...document.querySelectorAll('dialog')].find(dialog => dialog.open);
	const press = (root, label) =>
		[...root.querySelectorAll('button')].find(button => button.textContent.trim() === label).click();
	const rename = (dialog, from, name) => {
		const input = [...dialog.querySelectorAll('input')].find(each => each.value === from);

		input.value = name;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
	};

	beforeAll(() => {
		fetch = spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
	});
	afterAll(() => fetch.mockRestore());

	const building = {
		id: 'b1',
		_v: 1,
		name: 'North Barn',
		type: 'Machine shed',
		status: 'needs_service',
		showLabel: false,
	};

	test("opens the building's dialog, and after a save the panel shows the saved record", async () => {
		const panel = new FieldPanel({ appendTo: document.body });
		const saved = [];

		await panel.showBuilding(building, { onSave: async data => (saved.push(data), { ...building, ...data, _v: 2 }) });
		await settle();

		panel._editBtn.elem.click();
		await settle();

		const dialog = openDialog();

		expect(dialog).toBeTruthy();
		expect(panel._content.elem.querySelector('input')).toBeNull();

		rename(dialog, 'North Barn', 'South Barn');
		press(dialog, 'Save');
		await settle();

		expect(saved).toEqual([
			expect.objectContaining({ name: 'South Barn', type: 'Machine shed', status: 'needs_service', showLabel: false }),
		]);
		expect(openDialog()).toBeUndefined();
		expect(panel._titleElem.elem.textContent).toContain('South Barn');
		expect(panel._entity.data._v).toBe(2);

		panel.elem.remove();
	});

	test('a failed save stays in the dialog with its reason, and the panel keeps the record it had', async () => {
		const panel = new FieldPanel({ appendTo: document.body });

		await panel.showBuilding(building, {
			onSave: async () => ({ status: 'error', response: { status: 500 }, body: { error: 'Disk full' } }),
		});
		await settle();

		panel._editBtn.elem.click();
		await settle();

		const dialog = openDialog();

		rename(dialog, 'North Barn', 'South Barn');
		press(dialog, 'Save');
		await settle();

		expect(openDialog()).toBe(dialog);
		expect(dialog.textContent).toContain('Disk full');
		expect(panel._titleElem.elem.textContent).toContain('North Barn');

		press(dialog, 'Cancel');
		panel.elem.remove();
	});

	test("opens the field's dialog, which checks the name the panel's form let through blank", async () => {
		const panel = new FieldPanel({ appendTo: document.body });
		const field = { id: 'f1', _v: 1, name: 'Creek Bottom', tenure: 'rent', status: 'fallow', trialGroup: 'T1' };
		const saved = [];

		panel._renderDetails = async () => {};
		await panel.showField(field, { onSave: async data => (saved.push(data), { ...field, ...data, _v: 2 }) });

		panel._editBtn.elem.click();
		await settle();

		const dialog = openDialog();

		rename(dialog, 'Creek Bottom', '');
		press(dialog, 'Save');
		await settle();

		expect(saved).toEqual([]);

		rename(dialog, '', 'Creek Bottom West');
		press(dialog, 'Save');
		await settle();

		expect(saved).toEqual([
			expect.objectContaining({ name: 'Creek Bottom West', tenure: 'rent', status: 'fallow', trialGroup: 'T1' }),
		]);
		expect(panel._titleElem.elem.textContent).toBe('Creek Bottom West');

		panel.elem.remove();
	});
});
