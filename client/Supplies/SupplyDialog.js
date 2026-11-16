import { FormDialog, Select, theme } from '@vanilla-bean/components';
import { ChoiceChips, emojiInput, keepGroupLayout, numberField, PropertiesField } from '../utils/formFields';

import { getBuildings } from '../api';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';

const { space } = theme;

export const SUPPLY_CATEGORY_SUGGESTIONS = [
	'Seed',
	'Cover Crop Seed',
	'Fertilizer',
	'Nitrogen',
	'Phosphorus',
	'Potassium',
	'Lime',
	'Gypsum',
	'Soil Amendment',
	'Herbicide',
	'Fungicide',
	'Insecticide',
	'Fuel',
	'Diesel',
	'Propane',
	'Service',
	'Contract Labor',
	'Custom Application',
	'Other',
];

export const SUPPLY_UNIT_SUGGESTIONS = [
	'lbs',
	'tons',
	'gallons',
	'quarts',
	'oz',
	'fl oz',
	'bushels',
	'bags',
	'cwt',
	'units',
	'acres treated',
	'hours',
	'loads',
];

const EMOJI_MAP = [
	[/\bseed\b|corn|soybean|wheat|sorghum|canola|oat/i, '🌱'],
	[/cover crop/i, '🌿'],
	[/fertilizer|nitrogen|phosphorus|potassium|npk|urea|anhydrous/i, '🌿'],
	[/lime|gypsum|amendment|calcium|sulfur/i, '💧'],
	[/herbicide|roundup|glyphosate|atrazine|weed/i, '🧪'],
	[/fungicide|fungal/i, '🧫'],
	[/insecticide|pest|insect/i, '🐛'],
	[/fuel|diesel|propane|gas/i, '⛽'],
	[/service|contract|labor|custom|application/i, '🔧'],
];

export const detectSupplyEmoji = (category, stored) => {
	if (stored) return stored;

	for (const [pattern, emoji] of EMOJI_MAP) {
		if (pattern.test(category || '')) return emoji;
	}

	return '📦';
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

const NOT_ASSIGNED = { value: '', label: '— not assigned to a building —' };

const PRICE_MODES = [
	{ value: 'markup', label: '% Markup' },
	{ value: 'fixed', label: 'Fixed price' },
];

const markup = data => data.pricing === 'markup';

export default class SupplyDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.supply?.id;
		const supply = options.supply || {};
		const preBuildingId = options.buildingId || supply.buildingId || '';
		const field = key => this.form.inputElements[key];
		// The price at the markup typed, on the cost typed
		const showCalculated = () => {
			const cost = Number(field('costPerUnit').options.value) || 0;
			const pct = Number(field('markup').options.value) || 0;

			this.form.options.data.calculatedPrice = cost > 0 ? `$${(cost * (1 + pct / 100)).toFixed(2)}` : '—';
		};

		// Fields that aren't the record's own keys as it holds them are named apart, so a change made on another device
		// is compared only with the fields that hold it as it's saved
		super({
			header: isEdit ? `Edit Supply — ${supply.name}` : 'Add Supply Item',
			data: {
				emojiShown: supply.emoji || detectSupplyEmoji(supply.category || ''),
				buildingId: preBuildingId,
				name: supply.name || '',
				category: supply.category || '',
				unit: supply.unit || '',
				costPerUnit: supply.costPerUnit || '',
				currentStock: supply.currentStock || '',
				props: supply.properties || {},
				pricing: supply.priceMode || 'markup',
				markup: supply.markupPercent || '50',
				calculatedPrice: '',
				fixedPrice: supply.pricePerUnit || '',
			},
			inputs: [
				emojiInput('emojiShown', { title: 'Tap to change emoji — auto-detected from category' }),
				// Opened from a building, the supply is stored there; otherwise it's picked
				...(options.buildingId
					? []
					: [
							{
								key: 'buildingId',
								label: 'Stored in building (optional)',
								InputComponent: Select,
								// The supply's own building until the list arrives, so it isn't lost meanwhile
								options: [NOT_ASSIGNED, ...(preBuildingId ? [{ value: preBuildingId, label: '…' }] : [])],
							},
						]),
				{
					key: 'name',
					label: 'Name',
					placeholder: 'e.g. Pioneer P1197AM, Ag Lime, Roundup',
					required: true,
					validate: v => (v ? null : 'Name is required'),
				},
				{
					key: 'category',
					label: 'Category',
					placeholder: 'e.g. Seed, Herbicide, Lime',
					suggestions: SUPPLY_CATEGORY_SUGGESTIONS,
					onChange: ({ value }) => (field('emojiShown').options.auto = detectSupplyEmoji(value)),
				},
				{
					key: 'unit',
					label: 'Unit',
					placeholder: 'e.g. lbs, gallons, bags',
					suggestions: SUPPLY_UNIT_SUGGESTIONS,
				},
				{
					key: 'costPerUnit',
					label: 'Cost per Unit ($)',
					type: 'number',
					step: '0.01',
					placeholder: 'e.g. 4.25 per lb',
					onChange: showCalculated,
				},
				{
					key: 'currentStock',
					label: 'Current Stock (optional)',
					type: 'number',
					step: '0.01',
					placeholder: 'How much on hand',
				},
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },

				// The price it sells at: a markup on its cost, or a fixed price
				{ key: 'pricing', label: 'Sale Price', InputComponent: ChoiceChips, choices: PRICE_MODES },
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{
							key: 'markup',
							label: 'Markup (%)',
							placeholder: '50',
							...numberField({ step: '1', min: '0' }),
							condition: markup,
							onInput: showCalculated,
						},
						{
							key: 'calculatedPrice',
							label: 'Calculated price',
							placeholder: '—',
							attributes: { readonly: '' },
							style: { opacity: '0.6' },
							condition: markup,
						},
					],
				},
				{
					key: 'fixedPrice',
					label: 'Fixed sale price ($)',
					placeholder: '0.00',
					...numberField({ step: '0.01' }),
					condition: data => !markup(data),
				},
			],
			onSave: async d => {
				return stayOpenFor(
					await options.onSave?.({
						name: d.name,
						category: d.category,
						unit: d.unit,
						costPerUnit: d.costPerUnit,
						currentStock: d.currentStock,
						emoji: d.emojiShown !== detectSupplyEmoji(d.category || '') ? d.emojiShown : '',
						buildingId: d.buildingId,
						priceMode: d.pricing,
						markupPercent: d.markup,
						pricePerUnit: d.fixedPrice,
						properties: d.props,
					}),
				);
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete "${supply.name || 'this supply'}"?` },
			}),
			...withoutCallbacks(options),
		});

		keepGroupLayout(this.form);
		showCalculated();

		if (!options.buildingId) {
			getBuildings()
				.then(data => {
					field('buildingId').options.options = [
						NOT_ASSIGNED,
						...Object.values(data?.body || {})
							.sort((a, z) => (a.name || '').localeCompare(z.name || ''))
							.map(b => ({ value: b.id, label: b.name || 'Unnamed building' })),
					];

					if (preBuildingId) this.form.options.data.buildingId = field('buildingId').options.value = preBuildingId;
				})
				.catch(() => {
					/* building list unavailable */
				});
		}

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'supplies', supply.id));
		}
	}
}

/**
 * Compute the effective sale price for a supply item
 * @param supply
 */
export const salePriceForSupply = supply => {
	if (!supply) return null;

	if (supply.priceMode === 'fixed' && supply.pricePerUnit) return Number(supply.pricePerUnit);

	const cost = Number(supply.costPerUnit) || 0;

	if (!cost) return null;

	const markup = supply.markupPercent != null && supply.markupPercent !== '' ? Number(supply.markupPercent) : 50;

	return cost * (1 + markup / 100);
};
