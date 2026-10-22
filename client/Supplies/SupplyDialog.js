import { FormDialog, Elem, Button, Input, SectionLabel, Select, theme } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';

import { getBuildings } from '../api';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { FormLabel } from '../Layout';

const { colors } = theme;

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

export default class SupplyDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.supply?.id;
		const supply = options.supply || {};
		const preBuildingId = options.buildingId || supply.buildingId || '';

		super({
			size: 'large',
			header: isEdit ? `Edit Supply — ${supply.name}` : 'Add Supply Item',
			data: {
				name: supply.name || '',
				category: supply.category || '',
				unit: supply.unit || '',
				costPerUnit: supply.costPerUnit || '',
				currentStock: supply.currentStock || '',
			},
			inputs: [
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
					onChange: ({ value }) => {
						if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = detectSupplyEmoji(value);
					},
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
				},
				{
					key: 'currentStock',
					label: 'Current Stock (optional)',
					type: 'number',
					step: '0.01',
					placeholder: 'How much on hand',
				},
			],
			onSave: async d => {
				return keepOpenIfFailed(
					await options.onSave?.({
						...d,
						emoji: this._getEmoji?.() || '',
						buildingId: this._buildingId ?? preBuildingId,
						priceMode: this._priceMode ?? 'markup',
						markupPercent: this._markupPct ?? '50',
						pricePerUnit: this._fixedPrice ?? '',
						properties: this._collectProps?.() ?? {},
					}),
				);
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete "${supply.name || 'this supply'}"?` },
			}),
			...withoutCallbacks(options),
		});

		// Emoji row
		const emojiRow = new Elem({
			tag: 'div',
			appendTo: this.intro,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' },
		});

		const emojiInput = new Input({
			appendTo: emojiRow,
			type: 'text',
			attributes: {
				maxlength: '4',
				title: 'Tap to change emoji — auto-detected from category',
			},
			style: { fontSize: '22px', padding: '4px', width: '52px', textAlign: 'center', flexShrink: '0' },
		});

		emojiInput.elem.value = supply.emoji || detectSupplyEmoji(supply.category || '');

		const emojiHint = new Elem({
			tag: 'span',
			appendTo: emojiRow,
			style: { fontSize: '11px', color: colors.gray },
			textContent: supply.emoji ? 'Custom · clear to auto-detect' : 'Auto-detected · tap to change',
		});

		emojiInput.elem.addEventListener('input', () => {
			emojiInput.elem.dataset.manual = emojiInput.elem.value ? '1' : '';
			emojiHint.elem.textContent = emojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		this._buildingId = preBuildingId;

		// If no pre-set building, show a building selector
		if (!options.buildingId) {
			const bldgRow = new Elem({ tag: 'div', appendTo: this.intro, style: { marginBottom: '4px' } });

			new FormLabel({ appendTo: bldgRow, textContent: 'Stored in building (optional)', style: { marginTop: '0' } });

			const buildingSelect = new Select({ appendTo: bldgRow });

			const noOpt = document.createElement('option');

			noOpt.value = '';
			noOpt.textContent = '— not assigned to a building —';
			buildingSelect.elem.append(noOpt);

			getBuildings()
				.then(data => {
					for (const b of Object.values(data?.body || {}).sort((a, z) => (a.name || '').localeCompare(z.name || ''))) {
						const opt = document.createElement('option');

						opt.value = b.id;
						opt.textContent = b.name || 'Unnamed building';
						buildingSelect.elem.append(opt);
					}

					if (preBuildingId) buildingSelect.elem.value = preBuildingId;
				})
				.catch(() => {
					/* building list unavailable */
				});

			buildingSelect.elem.addEventListener('change', () => {
				this._buildingId = buildingSelect.elem.value;
			});
		}

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'supplies', supply.id));
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, supply.properties || {});
		this._collectProps = collectProps;

		this._getEmoji = () => {
			const auto = detectSupplyEmoji(this.form.options.data.category || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		// Pricing section — cost vs sale price
		const pricingDiv = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { marginTop: '12px', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' },
		});

		new SectionLabel({ appendTo: pricingDiv, textContent: 'Sale Price', style: { margin: '0 0 8px' } });

		// Mode toggle
		const modeRow = new Elem({
			tag: 'div',
			appendTo: pricingDiv,
			style: { display: 'flex', gap: '6px', marginBottom: '8px' },
		});

		this._priceMode = supply.priceMode || 'markup';
		this._markupPct = supply.markupPercent || '50';
		this._fixedPrice = supply.pricePerUnit || '';

		const makeModeBtn = (label, value, onPress) =>
			new Button({
				appendTo: modeRow,
				variant: 'chip',
				textContent: label,
				attributes: { type: 'button', 'data-mode': value },
				style: { flex: '1' },
				onPointerPress: onPress,
			});

		// Markup fields
		const markupWrap = new Elem({
			tag: 'div',
			appendTo: pricingDiv,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
		});

		const markupLabelStyle = { marginTop: '0' };

		new FormLabel({ appendTo: markupWrap, textContent: 'Markup (%)', style: markupLabelStyle });
		new FormLabel({ appendTo: markupWrap, textContent: 'Calculated price', style: markupLabelStyle });

		const markupInput = new Input({ appendTo: markupWrap });

		Object.assign(markupInput.elem, { type: 'number', step: '1', min: '0', value: this._markupPct, placeholder: '50' });

		const calcDisplay = new Input({ appendTo: markupWrap, style: { opacity: '0.6' } });

		Object.assign(calcDisplay.elem, { type: 'text', readOnly: true, placeholder: '—' });

		// Fixed price field
		const fixedWrap = new Elem({
			tag: 'div',
			appendTo: pricingDiv,
			style: { display: 'none' },
		});

		new FormLabel({ appendTo: fixedWrap, textContent: 'Fixed sale price ($)', style: markupLabelStyle });

		const fixedInput = new Input({ appendTo: fixedWrap });

		Object.assign(fixedInput.elem, { type: 'number', step: '0.01', value: this._fixedPrice, placeholder: '0.00' });

		const updateCalc = () => {
			const cost = Number(this.form.options.data.costPerUnit) || 0;
			const pct = Number(markupInput.elem.value) || 0;

			calcDisplay.elem.value = cost > 0 ? `$${(cost * (1 + pct / 100)).toFixed(2)}` : '—';
		};

		const applyMode = () => {
			const isMarkup = this._priceMode === 'markup';

			markupWrap.setStyle({ display: isMarkup ? 'grid' : 'none' });
			fixedWrap.setStyle({ display: isMarkup ? 'none' : 'block' });

			for (const btn of modeRow.elem.querySelectorAll('button')) {
				btn.classList.toggle('active', btn.dataset.mode === this._priceMode);
			}

			updateCalc();
		};

		makeModeBtn('% Markup', 'markup', () => {
			this._priceMode = 'markup';
			applyMode();
		});
		makeModeBtn('Fixed price', 'fixed', () => {
			this._priceMode = 'fixed';
			applyMode();
		});

		markupInput.elem.addEventListener('input', () => {
			this._markupPct = markupInput.elem.value;
			updateCalc();
		});
		fixedInput.elem.addEventListener('input', () => {
			this._fixedPrice = fixedInput.elem.value;
		});

		// Sync when cost changes via the Form
		const costKey = 'costPerUnit';

		if (this.form.options.inputs) {
			const costInput = this.form.options.inputs.find(i => i.key === costKey);

			if (costInput) {
				const prev = costInput.onChange;

				costInput.onChange = args => {
					prev?.(args);
					updateCalc();
				};
			}
		}

		applyMode();
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
