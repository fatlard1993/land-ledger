import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { getFields } from '../api';
import PrecisionLayerImport from './PrecisionLayerImport.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

const preview = {
	rowCount: 3,
	columns: ['lat', 'lon', 'Yield'],
	sample: [
		{ lat: 38.1, lon: -97.1, Yield: 182 },
		{ lat: 38.2, lon: -97.2, Yield: 175 },
	],
};

describe("a precision layer's import settings", () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('show the sample as a table, guess the value column, and import with what was set', async () => {
		const sent = [];
		const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
			if (url === '/precision-layers/import') {
				sent.push(Object.fromEntries([...init.body.entries()].filter(([key]) => key !== 'file')));

				return Response.json({ originalCount: 3, points: [], stats: {} });
			}

			return Response.json({ f1: { id: 'f1', name: 'Creek Bottom' } });
		});
		// A list another test read is kept; read afresh, it's this test's
		(await getFields()).invalidateCache?.();

		const dialog = new PrecisionLayerImport({ appendTo: document.body, presetFieldId: 'f1' });

		await dialog._renderConfig(new File(['lat,lon'], 'yield.csv'), preview);
		await settle();

		expect([...dialog.elem.querySelectorAll('th')].map(th => th.textContent)).toEqual(['lat', 'lon', 'Yield']);
		expect(dialog.elem.querySelectorAll('tbody tr')).toHaveLength(2);

		const label = text => [...dialog.elem.querySelectorAll('label')].find(each => each.textContent === text);
		const field = text => document.getElementById(label(text).htmlFor);

		expect(field('Data value column *').value).toBe('Yield');

		field('Value unit (e.g. bu/ac, seeds/ac)').value = 'bu/ac';
		field('Value unit (e.g. bu/ac, seeds/ac)').dispatchEvent(new Event('input'));
		[...dialog.elem.querySelectorAll('button')].find(button => button.textContent === 'Import layer').click();
		await settle();

		expect(sent).toEqual([
			{
				fieldId: 'f1',
				type: 'yield',
				valueField: 'Yield',
				valueUnit: 'bu/ac',
				season: String(new Date().getFullYear()),
			},
		]);

		fetch.mockRestore();
	});
});
