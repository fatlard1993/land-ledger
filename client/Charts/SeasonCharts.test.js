import { describe, test, expect, spyOn } from 'bun:test';

import SeasonCharts from './SeasonCharts.js';

describe('SeasonCharts', () => {
	test('redraws when what it charts changes', () => {
		const render = spyOn(SeasonCharts.prototype, '_renderCharts').mockImplementation(() => {});
		const charts = new SeasonCharts({ appendTo: document.body, events: [], allEvents: [], allFields: [] });

		expect(render).toHaveBeenCalledTimes(1);

		for (const key of ['events', 'fieldFilter', 'allEvents', 'allFields']) charts.options[key] = [];

		expect(render).toHaveBeenCalledTimes(5);
		render.mockRestore();
	});
});
