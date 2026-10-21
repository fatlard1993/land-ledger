import { describe, test, expect } from 'bun:test';

import { EquipmentLayer } from './EquipmentLayer.js';

describe('EquipmentLayer', () => {
	test('makeIcon builds a marker icon', () => {
		const layer = new EquipmentLayer(null, null);
		const icon = layer.makeIcon({ id: 'a', type: 'tractor', tenure: 'own', size: 'med' }, false, {});

		expect(icon.options.html).toContain('border-radius:50%');
	});
});
