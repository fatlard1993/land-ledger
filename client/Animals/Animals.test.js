import { afterEach, describe, expect, test } from 'bun:test';

import Animals from './Animals.js';

const ANIMALS = {
	a1: { id: 'a1', tagId: '12', name: 'Daisy', breed: 'Angus', species: 'cattle', fieldId: 'f1', status: 'active' },
	a2: { id: 'a2', tagId: '07', species: 'cattle', status: 'sold' },
};

const FIELDS = { f1: { id: 'f1', name: 'Creek Bottom' } };

// The list with its data handed in, and the animals it was asked to open
const animalsWith = (animals = ANIMALS) => {
	const opened = [];

	class Listed extends Animals {
		_datasources() {
			return {
				_animals: async () => ({ status: 'success', body: structuredClone(animals) }),
				_fields: async () => ({ status: 'success', body: FIELDS }),
			};
		}

		_openPanel(animal) {
			opened.push(animal.id);
		}
	}

	return { view: new Listed({ appendTo: document.body }), opened };
};

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('the animals list', () => {
	let view;

	afterEach(() => view?.destroy());

	test('is a table of the animals by tag, each row with its name, breed, field and status', async () => {
		({ view } = animalsWith());
		await settle();

		const headings = [...view.elem.querySelectorAll('th')].map(th => th.textContent);
		const rows = [...view.elem.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent));

		expect(headings).toEqual(['Tag', 'Name / Breed', 'Species', 'Field', 'Age', 'Status']);
		expect(rows.map(row => row[0])).toEqual(['#07', '#12']);
		expect(rows[1][1]).toBe('DaisyAngus');
		expect(rows[1][3]).toBe('Creek Bottom');
		expect(rows[0][3]).toBe('—');
		expect(rows[0][5]).toBe('sold');
	});

	test('opens the animal from anywhere in its row, and from its tag by keyboard', async () => {
		let opened;
		({ view, opened } = animalsWith());
		await settle();

		const [, daisy] = view.elem.querySelectorAll('tbody tr');

		daisy.querySelector('.status').click();

		const tag = daisy.querySelector('.tag');

		expect(tag.getAttribute('role')).toBe('button');
		expect(tag.getAttribute('aria-label')).toBe('Open Daisy');
		tag.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(opened).toEqual(['a1', 'a1']);
	});

	test('with no animals, says so instead of an empty table', async () => {
		({ view } = animalsWith({}));
		await settle();

		expect(view.elem.querySelector('table')).toBeNull();
		expect(view.elem.textContent).toContain('No animals registered');
	});
});
