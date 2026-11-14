import { Component, Input, theme } from '@vanilla-bean/components';

import { FormLabel } from '../Layout';
import { toNum } from '../utils/format.js';

const { space } = theme;

const OUTPUT_SUGGESTIONS = [
	'Corn',
	'Soybeans',
	'Winter Wheat',
	'Spring Wheat',
	'Grain Sorghum',
	'Oats',
	'Barley',
	'Hay — 1st cutting',
	'Hay — 2nd cutting',
	'Hay — 3rd cutting',
	'Straw',
	'Beef',
	'Cull Cows',
	'Feeder Calves',
	'Lambs',
	'Cull Ewes',
	'Market Hogs',
	'Broilers',
	'Eggs',
	'Wool',
	'Milk',
	'Honey',
];

const UNIT_SUGGESTIONS = ['bu', 'tons', 'cwt', 'lbs', 'head', 'dozen', 'gallons', 'bales', 'bags'];

export function buildHarvestSection(container, prev, g, { onEmojiRefresh } = {}) {
	new FormLabel({ appendTo: container, textContent: 'Output' });
	const outputEl = new Input({
		appendTo: container,
		attributes: { placeholder: 'e.g. Corn, Hay — 1st cutting, Eggs' },
		suggestions: OUTPUT_SUGGESTIONS,
	});

	outputEl.options.value = prev.outputType || '';
	outputEl.elem.addEventListener('input', () => onEmojiRefresh?.(outputEl.options.value));

	// Yield / acre — the key field for county benchmark comparison
	const yieldRow = new Component({
		appendTo: container,
		style: { display: 'grid', gridTemplateColumns: '1fr 80px', gap: space.sm },
	});

	new FormLabel({ appendTo: yieldRow, textContent: 'Yield / Acre' });
	const yieldEl = new Input({
		appendTo: yieldRow,
		attributes: { type: 'number', step: '0.01', placeholder: 'e.g. 85.5' },
	});

	yieldEl.options.value = prev.yieldPerAcre != null ? String(prev.yieldPerAcre) : '';

	new FormLabel({ appendTo: yieldRow, textContent: 'Unit' });
	const yieldUnitEl = new Input({
		appendTo: yieldRow,
		attributes: { placeholder: 'bu' },
		suggestions: UNIT_SUGGESTIONS,
	});

	yieldUnitEl.options.value = prev.yieldUnit || prev.unit || '';

	const row1 = new Component({
		appendTo: container,
		style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: space.sm },
	});

	new FormLabel({ appendTo: row1, textContent: 'Total quantity (optional)' });
	const qtyEl = new Input({
		appendTo: row1,
		attributes: { type: 'number', step: '0.01', placeholder: 'Whole-field total' },
	});

	qtyEl.options.value = prev.quantity || '';

	new FormLabel({ appendTo: row1, textContent: 'Unit' });
	const unitEl = new Input({
		appendTo: row1,
		attributes: { placeholder: 'bu, lbs…' },
		suggestions: UNIT_SUGGESTIONS,
	});

	unitEl.options.value = prev.unit || prev.yieldUnit || '';

	// Keep yield unit and quantity unit in sync
	yieldUnitEl.elem.addEventListener('input', () => {
		if (!unitEl.options.value) unitEl.options.value = yieldUnitEl.options.value;
	});
	unitEl.elem.addEventListener('input', () => {
		if (!yieldUnitEl.options.value) yieldUnitEl.options.value = unitEl.options.value;
	});

	const row2 = new Component({
		appendTo: container,
		style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
	});

	new FormLabel({ appendTo: row2, textContent: 'Price / Unit ($)' });
	const priceEl = new Input({
		appendTo: row2,
		attributes: { type: 'number', step: '0.0001', placeholder: 'Optional' },
	});

	priceEl.options.value = prev.pricePerUnit || '';

	new FormLabel({ appendTo: row2, textContent: 'Revenue ($)' });
	const revenueEl = new Input({
		appendTo: row2,
		attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
	});

	revenueEl.options.value = prev.revenue || '';

	// Auto-calc revenue from quantity × price
	const recalculate = () => {
		if (qtyEl.options.value !== '' && priceEl.options.value !== '' && revenueEl.options.value === '') {
			revenueEl.elem.placeholder = `$${(Number(qtyEl.options.value) * Number(priceEl.options.value)).toFixed(2)}`;
		}
	};

	qtyEl.elem.addEventListener('input', recalculate);
	priceEl.elem.addEventListener('input', recalculate);

	g.name = () => outputEl.options.value || 'Harvest';
	g.details = () => ({
		outputType: outputEl.options.value,
		yieldPerAcre: toNum(yieldEl.options.value),
		yieldUnit: yieldUnitEl.options.value || unitEl.options.value || null,
		quantity: toNum(qtyEl.options.value),
		unit: unitEl.options.value || yieldUnitEl.options.value,
		pricePerUnit: toNum(priceEl.options.value),
		revenue: (() => {
			if (revenueEl.options.value !== '') return Number(revenueEl.options.value);
			const calculatedRevenue =
				qtyEl.options.value !== '' && priceEl.options.value !== ''
					? Number(qtyEl.options.value) * Number(priceEl.options.value)
					: null;
			return calculatedRevenue;
		})(),
	});
}
