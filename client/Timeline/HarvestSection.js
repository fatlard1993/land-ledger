import { theme } from '@vanilla-bean/components';

import { toNum } from '../utils/format.js';
import { numberField } from '../utils/formFields';

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

const harvest = data => data.category === 'harvest';

// A harvest's fields as they start, from the details it was saved with
export const harvestData = prev => ({
	harvestOutput: prev.outputType || '',
	harvestYield: prev.yieldPerAcre != null ? String(prev.yieldPerAcre) : '',
	harvestYieldUnit: prev.yieldUnit || prev.unit || '',
	harvestQty: prev.quantity || '',
	harvestUnit: prev.unit || prev.yieldUnit || '',
	harvestPrice: prev.pricePerUnit || '',
	harvestRevenue: prev.revenue || '',
});

/**
 * A harvest's fields, as Form inputs shown while the event is a harvest
 * @param {object} options - Behaviour the fields share with the dialog
 * @param {Function} options.form - The dialog's Form, once there is one
 * @param {Function} options.onEmojiRefresh - Hears the output as it's typed, to guess the emoji from
 * @returns {Array<object>} The inputs
 */
export const harvestInputs = ({ form, onEmojiRefresh }) => {
	const field = key => form().inputElements[key];
	const data = () => form().options.data;

	// The revenue's placeholder is quantity × price until a revenue is typed
	const recalculate = () => {
		const qty = field('harvestQty').options.value;
		const price = field('harvestPrice').options.value;

		if (qty !== '' && price !== '' && field('harvestRevenue').options.value === '') {
			field('harvestRevenue').elem.placeholder = `$${(Number(qty) * Number(price)).toFixed(2)}`;
		}
	};

	return [
		{
			key: 'harvestOutput',
			label: 'Output',
			condition: harvest,
			placeholder: 'e.g. Corn, Hay — 1st cutting, Eggs',
			suggestions: OUTPUT_SUGGESTIONS,
			onInput: ({ value }) => onEmojiRefresh(value),
		},
		// Yield / acre — the key field for county benchmark comparison
		{
			type: 'group',
			style: { display: 'grid', gridTemplateColumns: '1fr 80px', gap: space.sm },
			inputs: [
				{
					key: 'harvestYield',
					label: 'Yield / Acre',
					condition: harvest,
					placeholder: 'e.g. 85.5',
					...numberField({ step: '0.01' }),
				},
				{
					key: 'harvestYieldUnit',
					label: 'Unit',
					condition: harvest,
					placeholder: 'bu',
					suggestions: UNIT_SUGGESTIONS,
					// The quantity's unit follows the yield's until it has its own, and the other way round
					onInput: ({ value }) => {
						if (!field('harvestUnit').options.value) data().harvestUnit = value;
					},
				},
			],
		},
		{
			type: 'group',
			style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: space.sm },
			inputs: [
				{
					key: 'harvestQty',
					label: 'Total quantity (optional)',
					condition: harvest,
					placeholder: 'Whole-field total',
					...numberField({ step: '0.01' }),
					onInput: recalculate,
				},
				{
					key: 'harvestUnit',
					label: 'Unit',
					condition: harvest,
					placeholder: 'bu, lbs…',
					suggestions: UNIT_SUGGESTIONS,
					onInput: ({ value }) => {
						if (!field('harvestYieldUnit').options.value) data().harvestYieldUnit = value;
					},
				},
			],
		},
		{
			type: 'group',
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
			inputs: [
				{
					key: 'harvestPrice',
					label: 'Price / Unit ($)',
					condition: harvest,
					placeholder: 'Optional',
					...numberField({ step: '0.0001' }),
					onInput: recalculate,
				},
				{
					key: 'harvestRevenue',
					label: 'Revenue ($)',
					condition: harvest,
					placeholder: 'Optional',
					...numberField({ step: '0.01' }),
				},
			],
		},
	];
};

// A harvest's name and details, as the event saves them; the revenue is quantity × price when none was typed
export const harvestRecord = data => {
	const { harvestOutput, harvestYield, harvestYieldUnit, harvestQty, harvestUnit, harvestPrice, harvestRevenue } = data;
	const calculated = harvestQty !== '' && harvestPrice !== '' ? Number(harvestQty) * Number(harvestPrice) : null;

	return {
		name: harvestOutput || 'Harvest',
		details: {
			outputType: harvestOutput,
			yieldPerAcre: toNum(harvestYield),
			yieldUnit: harvestYieldUnit || harvestUnit || null,
			quantity: toNum(harvestQty),
			unit: harvestUnit || harvestYieldUnit,
			pricePerUnit: toNum(harvestPrice),
			revenue: harvestRevenue !== '' ? Number(harvestRevenue) : calculated,
		},
	};
};
