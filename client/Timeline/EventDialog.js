import { Button, Component, Elem, FormDialog, Input, parseDate, Select, styled } from '@vanilla-bean/components';

import { EVENT_CATEGORIES, categoryMeta } from '../eventCategories';
import { FormLabel } from '../Layout';
import { getFields } from '../api';
import { makeCropCombobox } from '../Charts/cropCombobox';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toDateOnly } from '../utils/dates';
import { buildHarvestSection } from './HarvestSection.js';
import { buildCoverCropSection } from './CoverCropSection.js';

const CategoryGrid = styled(
	Component,
	() => `
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
		margin-bottom: 6px;

		/* A long label ends in an ellipsis */
		& > .vbc-button {
			min-width: 0;
			padding: 6px 4px;
			overflow: hidden;
		}
	`,
);

const EmojiRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;

		& > input {
			flex-shrink: 0;
			width: 52px;
			padding: 4px;
			font-size: 22px;
			text-align: center;
			cursor: text;
		}

		& > .hint {
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

const ResultsGrid = styled(
	Component,
	() => `
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 10px;
		margin-top: 4px;

		& label {
			margin-top: 0;
		}

		& input {
			margin-top: 2px;
		}
	`,
);

export const detectEmoji = (category, name = '') => {
	const n = name.toLowerCase();

	if (category === 'livestock') {
		if (/cattle|cow|bull|calf|heifer|angus|hereford|bison|longhorn/i.test(n)) return '🐄';
		if (/sheep|lamb|ewe|ram|dorper|merino|hair sheep/i.test(n)) return '🐑';
		if (/goat|kid|boer|nubian/i.test(n)) return '🐐';
		if (/chicken|hen|rooster|broiler|layer|pullet|chick/i.test(n)) return '🐔';
		if (/turkey/i.test(n)) return '🦃';
		if (/pig|hog|swine|pork|sow|boar|berkshire|duroc/i.test(n)) return '🐷';
		if (/duck/i.test(n)) return '🦆';
		if (/goose|geese/i.test(n)) return '🪿';
		if (/horse|mare|stallion|gelding/i.test(n)) return '🐴';
		if (/bee|hive/i.test(n)) return '🐝';
		if (/rabbit|bunny/i.test(n)) return '🐰';
		if (/deer|venison/i.test(n)) return '🦌';
		if (/alpaca|llama/i.test(n)) return '🦙';
		if (/donkey|mule/i.test(n)) return '🫏';
		if (/bison|buffalo/i.test(n)) return '🦬';
		return '🐄';
	}

	if (category === 'crop') {
		if (/corn|maize/i.test(n)) return '🌽';
		if (/soy|soybean/i.test(n)) return '🫘';
		if (/wheat|barley|oat|grain/i.test(n)) return '🌾';
		if (/cereal.rye|rye/i.test(n)) return '🌾';
		if (/sunflower/i.test(n)) return '🌻';
		if (/potato/i.test(n)) return '🥔';
		if (/tomato/i.test(n)) return '🍅';
		if (/pumpkin|squash|gourd/i.test(n)) return '🎃';
		if (/hay|alfalfa|forage|grass/i.test(n)) return '🌿';
		if (/cotton/i.test(n)) return '🌸';
		if (/peanut/i.test(n)) return '🥜';
		if (/sorghum/i.test(n)) return '🌾';
		return '🌽';
	}

	if (category === 'cover_crop') {
		if (/rye|barley|wheat|oat|grain|cereal/i.test(n)) return '🌾';
		if (/vetch|clover|legume|pea|bean/i.test(n)) return '🍀';
		if (/sunflower/i.test(n)) return '🌻';
		if (/radish|turnip|brassica/i.test(n)) return '🌱';
		if (/buckwheat/i.test(n)) return '🌸';
		return '🌱';
	}

	if (category === 'harvest') {
		if (/egg/i.test(n)) return '🥚';
		if (/wool|fleece|shear/i.test(n)) return '🧶';
		if (/milk|dairy/i.test(n)) return '🥛';
		if (/honey/i.test(n)) return '🍯';
		if (/hay|straw|bale/i.test(n)) return '🌾';
		if (/grain|corn|wheat|soy|sorghum|oat|barley|bean/i.test(n)) return '🌽';
		if (/beef|steer|cattle|calf|cull/i.test(n)) return '🐄';
		if (/lamb|sheep|ewe/i.test(n)) return '🐑';
		if (/pork|hog|pig/i.test(n)) return '🐷';
		if (/chicken|broiler|meat bird/i.test(n)) return '🐔';
		return '🌾';
	}

	return categoryMeta(category).emoji;
};

export const eventEmoji = event => event?.emoji || detectEmoji(event?.category, event?.name);

const INPUT_TYPES = [
	{ value: 'herbicide', label: 'Herbicide' },
	{ value: 'fertilizer', label: 'Fertilizer' },
	{ value: 'fungicide', label: 'Fungicide' },
	{ value: 'insecticide', label: 'Insecticide' },
	{ value: 'soil_amendment', label: 'Soil Amendment' },
	{ value: 'compost', label: 'Compost / manure' },
	{ value: 'seed_treatment', label: 'Seed Treatment' },
	{ value: 'other', label: 'Other' },
];

const TILLAGE_TYPES = [
	{ value: 'no_till', label: 'No-till' },
	{ value: 'strip_till', label: 'Strip-till' },
	{ value: 'reduced', label: 'Reduced tillage' },
	{ value: 'conventional', label: 'Conventional' },
	{ value: 'deep_rip', label: 'Deep rip / subsoil' },
];

const OBS_TYPES = [
	{ value: 'weed_pressure', label: 'Weed pressure' },
	{ value: 'disease', label: 'Disease' },
	{ value: 'pest', label: 'Pest / insect' },
	{ value: 'stand_count', label: 'Stand count' },
	{ value: 'soil_health', label: 'Soil health visual' },
	{ value: 'compaction', label: 'Compaction' },
	{ value: 'earthworm_count', label: 'Earthworm count' },
	{ value: 'other', label: 'Other' },
];

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class EventDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.event?.id;

		// The body is built by hand below, so the form holds no inputs and saving collects from the body; a body that
		// doesn't validate collects nothing and keeps the dialog open
		super({
			size: 'large',
			header: isEdit ? 'Edit Event' : 'Log Event',
			inputs: [],
			onSave: async () => {
				const data = this._collectData();

				if (!data) return false;

				return keepOpenIfFailed(await options.onSave?.(data));
			},
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => keepOpenIfFailed(await options.onDelete(), 'Delete'),
					confirmDelete: { header: 'Delete this event?' },
				}),
			...withoutCallbacks(options),
		});

		this._event = options.event || {};
		this._fieldId = options.fieldId || this._event.fieldId || '';
		this._acreage = options.acreage || 0;
		this._getters = {};
		this._detailGetters = {};

		this._buildForm();
	}

	async _buildForm() {
		// Livestock species suggestions: the common ones, plus every species already logged
		const { getEvents } = await import('../api/events');
		const eventsData = await getEvents();
		const knownSpecies = new Set([
			'Cattle',
			'Angus cattle',
			'Hereford cattle',
			'Sheep',
			'Dorper sheep',
			'Hair sheep',
			'Chickens',
			'Broiler chickens',
			'Layer chickens',
			'Turkeys',
			'Pigs',
			'Ducks',
			'Geese',
			'Bison',
			'Goats',
			'Rabbits',
		]);

		for (const event of Object.values(eventsData?.body || {})) {
			if (event.category === 'livestock' && event.name) {
				knownSpecies.add(event.name.split(/[—–,(]/)[0].trim());
			}
		}

		this._knownSpecies = [...knownSpecies];

		const fieldsData = await getFields();
		const fieldOptions = Object.values(fieldsData?.body || {}).map(f => ({
			value: f.id,
			label: f.name || 'Unnamed Field',
			acreage: f.acreage,
		}));

		const form = new Component({ appendTo: this.body, style: { paddingBottom: '8px' } });

		new FormLabel({ appendTo: form, textContent: 'Field' });
		const fieldSelect = new Select({ appendTo: form });

		for (const { value: v, label: l } of fieldOptions) {
			const o = document.createElement('option');
			o.value = v;
			o.textContent = l;
			fieldSelect.elem.append(o);
		}

		fieldSelect.elem.value = this._fieldId || fieldOptions[0]?.value || '';

		this._getters.fieldId = () => fieldSelect.elem.value;

		fieldSelect.elem.addEventListener('change', () => {
			const opt = fieldOptions.find(f => f.value === fieldSelect.elem.value);

			this._acreage = opt?.acreage || 0;
			this._refreshCalculations?.();
		});

		// Tiered category selection — Crop and Stock first
		new FormLabel({ appendTo: form, textContent: 'Category' });

		let _selectedCategory = this._event.category || 'crop';

		const catRow = new CategoryGrid({ appendTo: form });

		const categoryButtons = new Map();

		const updateCategoryButtons = () => {
			for (const [value, btn] of categoryButtons) btn.toggleClass('active', value === _selectedCategory);
		};

		for (const { value, label } of EVENT_CATEGORIES) {
			const btn = new Button({
				textContent: label,
				appendTo: catRow,
				variant: 'chip',
				onPointerPress: () => {
					_selectedCategory = value;
					updateCategoryButtons();
					buildDetails();
					this._onCategoryChange?.();
				},
			});

			btn.elem.type = 'button';
			categoryButtons.set(value, btn);
		}

		updateCategoryButtons();

		this._getters.category = () => _selectedCategory;

		// Emoji row: auto-detected with override
		const emojiRow = new EmojiRow({ appendTo: form });

		const emojiPreview = new Input({
			appendTo: emojiRow,
			type: 'text',
			maxLength: 4,
			title: 'Tap to change emoji — auto-detected from event name',
		});

		emojiPreview.elem.value = this._event.emoji || detectEmoji(_selectedCategory, '');

		const emojiHint = new Elem({
			tag: 'span',
			appendTo: emojiRow,
			addClass: 'hint',
			textContent: 'Auto-detected · tap to change',
		});

		// Update emoji when name is entered (after detail section builds)
		this._refreshEmoji = name => {
			if (!emojiPreview.elem.dataset.manual) {
				const detected = detectEmoji(_selectedCategory, name);

				emojiPreview.elem.value = detected;
				emojiHint.elem.textContent = 'Auto-detected · tap to change';
			}
		};

		emojiPreview.elem.addEventListener('input', () => {
			emojiPreview.elem.dataset.manual = emojiPreview.elem.value ? '1' : '';
			emojiHint.elem.textContent = emojiPreview.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		// Hook into category change to refresh auto-detected emoji
		this._onCategoryChange = () => {
			if (!emojiPreview.elem.dataset.manual) emojiPreview.elem.value = detectEmoji(_selectedCategory, '');
		};

		this._getters.emoji = () => emojiPreview.elem.value || null;

		const today = toDateOnly();

		new FormLabel({ appendTo: form, textContent: 'Date' });
		const dateIn = new Input({ appendTo: form, attributes: { type: 'date' } });

		dateIn.elem.value = this._event.date || today;

		this._getters.date = () => dateIn.elem.value;
		this._getters.season = () => {
			const d = parseDate(dateIn.elem.value);

			return d ? d.getFullYear() : new Date().getFullYear();
		};

		dateIn.elem.addEventListener('change', () => this._refreshCalculations?.());

		this._detailContainer = new Component({ appendTo: form });

		let prevDetails = {};

		try {
			const rawDetails = this._event.details;
			const parsedDetails = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;
			prevDetails = parsedDetails || {};
		} catch {
			prevDetails = {};
		}

		const buildDetails = () => {
			this._detailContainer.empty();
			this._detailGetters = {};
			this._refreshCalculations = null;
			this._buildCategory(this._detailContainer, _selectedCategory, prevDetails);
		};

		buildDetails();

		new FormLabel({ appendTo: form, textContent: 'Notes' });
		const notesEl = new Input({
			appendTo: form,
			attributes: { type: 'text', placeholder: 'Optional' },
		});

		notesEl.elem.value = this._event.notes || '';
		this._getters.notes = () => notesEl.elem.value;
	}

	_buildCategory(container, category, prev) {
		const g = this._detailGetters;

		if (category === 'crop') {
			new FormLabel({ appendTo: container, textContent: 'Crop' });
			const speciesEl = makeCropCombobox(container.elem, prev.species || '', 'e.g. Corn, Winter Wheat, Grain Sorghum…');

			speciesEl.addEventListener('input', () => this._refreshEmoji?.(speciesEl.value));

			// Seed cost from inventory
			new FormLabel({ appendTo: container, textContent: 'Seed from inventory (optional)' });
			const seedSelect = new Select({ appendTo: container });

			seedSelect.elem.style.width = '100%';

			const seedNoneOpt = document.createElement('option');

			seedNoneOpt.value = '';
			seedNoneOpt.textContent = '— enter cost manually —';
			seedSelect.elem.append(seedNoneOpt);

			new FormLabel({ appendTo: container, textContent: 'Seed Cost/Acre ($)' });
			const seedCostEl = new Input({
				appendTo: container,
				attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
			});

			seedCostEl.elem.value = prev.seedCostPerAcre || '';

			import('../api/supplies')
				.then(({ getSupplies }) => getSupplies())
				.then(data => {
					const seeds = Object.values(data?.body || {})
						.filter(s => s.category === 'seed')
						.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

					for (const s of seeds) {
						const opt = document.createElement('option');

						opt.value = s.id;
						opt.textContent = `${s.name} ($${Number(s.costPerUnit || 0).toFixed(2)}/${s.unit || 'unit'})`;
						opt.dataset.costPerUnit = s.costPerUnit || '';
						opt.dataset.unit = s.unit || '';
						opt.dataset.name = s.name;
						seedSelect.elem.append(opt);
					}

					if (prev.seedSupplyId) seedSelect.elem.value = prev.seedSupplyId;
				})
				.catch(() => {
					/* supply list unavailable */
				});

			const { collect: collectCropProps } = makePropertiesEditor(container, {
				variety: prev.variety || '',
				seedingRate: prev.seedingRate || '',
			});

			g.name = () => {
				const p = collectCropProps();
				return `${speciesEl.value}${p.variety ? ` — ${p.variety}` : ''}`;
			};
			g.details = () => ({
				...collectCropProps(),
				species: speciesEl.value,
				seedCostPerAcre: seedCostEl.elem.value ? Number(seedCostEl.elem.value) : null,
				seedSupplyId: seedSelect.elem.value || null,
			});
		} else if (category === 'harvest') {
			this._buildHarvestSection(container, prev, g);
		} else if (category === 'cover_crop') {
			this._buildCoverCropSection(container, prev, g);
		} else if (category === 'livestock') {
			this._buildLivestockSection(container, prev, g);
		} else if (category === 'input') {
			new FormLabel({ appendTo: container, textContent: 'Type' });
			const typeSelect = new Select({ appendTo: container });

			for (const { value: v, label: l } of INPUT_TYPES) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = l;
				typeSelect.elem.append(o);
			}

			typeSelect.elem.value = prev.inputType || 'herbicide';

			new FormLabel({ appendTo: container, textContent: 'Product' });
			const productEl = new Input({ appendTo: container, attributes: { placeholder: 'e.g. Roundup' } });

			productEl.elem.value = prev.product || '';

			new FormLabel({ appendTo: container, textContent: 'Rate' });
			const rateEl = new Input({ appendTo: container, attributes: { placeholder: 'e.g. 22 oz/ac' } });

			rateEl.elem.value = prev.rate || '';

			new FormLabel({ appendTo: container, textContent: 'Cost/Acre ($)' });
			const costEl = new Input({ appendTo: container, attributes: { type: 'number', step: '0.01' } });

			costEl.elem.value = prev.costPerAcre || '';

			// Supply inventory link
			new FormLabel({ appendTo: container, textContent: 'From inventory (optional)' });
			const supplySelect = new Select({ appendTo: container });

			supplySelect.elem.style.width = '100%';

			const noneOpt = document.createElement('option');

			noneOpt.value = '';
			noneOpt.textContent = '— enter manually —';
			supplySelect.elem.append(noneOpt);

			// Load supply options asynchronously
			import('../api/supplies')
				.then(({ getSupplies }) => getSupplies())
				.then(data => {
					const inputSupplies = Object.values(data?.body || {}).filter(s =>
						['herbicide', 'fertilizer', 'amendment', 'fungicide', 'insecticide', 'other'].includes(s.category),
					);

					for (const s of inputSupplies.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
						const opt = document.createElement('option');

						opt.value = s.id;
						opt.textContent = `${s.name} ($${Number(s.costPerUnit || 0).toFixed(2)}/${s.unit || 'unit'})`;
						opt.dataset.name = s.name;
						opt.dataset.costPerUnit = s.costPerUnit || '';
						opt.dataset.unit = s.unit || '';
						supplySelect.elem.append(opt);
					}

					if (prev.supplyId) supplySelect.elem.value = prev.supplyId;
				})
				.catch(() => {
					/* supply list unavailable */
				});

			supplySelect.elem.addEventListener('change', () => {
				const opt = supplySelect.elem.selectedOptions[0];

				if (opt?.value && opt.dataset.name) {
					productEl.elem.value = opt.dataset.name;
					// Auto-fill rate placeholder with unit
					if (opt.dataset.unit) rateEl.elem.placeholder = `amount per ac (${opt.dataset.unit}/ac)`;
				}
			});

			// Auto-calculate cost when rate changes
			const recalculateCost = () => {
				const opt = supplySelect.elem.selectedOptions[0];

				if (!opt?.value || !opt.dataset.costPerUnit) return;

				const rateMatch = rateEl.elem.value.match(/[\d.]+/);

				if (rateMatch) {
					const rate = Number(rateMatch[0]);
					const cost = rate * Number(opt.dataset.costPerUnit);

					costEl.elem.value = cost.toFixed(2);
				}
			};

			rateEl.elem.addEventListener('input', recalculateCost);

			g.name = () => productEl.elem.value || typeSelect.elem.value;
			g.details = () => ({
				inputType: typeSelect.elem.value,
				product: productEl.elem.value,
				rate: rateEl.elem.value,
				costPerAcre: costEl.elem.value ? Number(costEl.elem.value) : null,
				supplyId: supplySelect.elem.value || null,
			});
		} else if (category === 'tillage') {
			new FormLabel({ appendTo: container, textContent: 'Type' });
			const typeSelect = new Select({ appendTo: container });

			for (const { value: v, label: l } of TILLAGE_TYPES) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = l;
				typeSelect.elem.append(o);
			}

			typeSelect.elem.value = prev.type || 'no_till';

			new FormLabel({ appendTo: container, textContent: 'Cost/Acre ($)' });
			const tillageCostEl = new Input({
				appendTo: container,
				attributes: { type: 'number', step: '0.01', placeholder: 'Optional' },
			});

			tillageCostEl.elem.value = prev.costPerAcre || '';

			const { collect: collectTillageProps } = makePropertiesEditor(container, {
				depth: prev.depth != null ? String(prev.depth) : '',
				equipment: prev.equipment || '',
			});

			g.name = () => TILLAGE_TYPES.find(t => t.value === typeSelect.elem.value)?.label || typeSelect.elem.value;
			g.details = () => ({
				...collectTillageProps(),
				type: typeSelect.elem.value,
				costPerAcre: tillageCostEl.elem.value ? Number(tillageCostEl.elem.value) : null,
			});
		} else if (category === 'soil_test') {
			const TIMING_OPTS = [
				{ value: 'pre-season', label: 'Pre-season' },
				{ value: 'post-harvest', label: 'Post-harvest' },
				{ value: 'mid-season', label: 'Mid-season' },
				{ value: 'fall', label: 'Fall' },
			];
			const DEPTH_OPTS = [
				{ value: '0-6 in', label: '0–6 in' },
				{ value: '6-12 in', label: '6–12 in' },
				{ value: '0-12 in', label: '0–12 in' },
			];

			new FormLabel({ appendTo: container, textContent: 'Lab' });
			const labEl = new Input({ appendTo: container, attributes: { placeholder: 'e.g. Regen Ag, Ward Labs' } });

			labEl.elem.value = prev.lab || '';

			new FormLabel({ appendTo: container, textContent: 'Timing' });
			const timingEl = new Select({ appendTo: container });

			for (const { value: v, label: l } of TIMING_OPTS) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = l;
				timingEl.elem.append(o);
			}

			timingEl.elem.value = prev.timing || 'pre-season';

			new FormLabel({ appendTo: container, textContent: 'Sample Depth' });
			const depthEl = new Select({ appendTo: container });

			for (const { value: v, label: l } of DEPTH_OPTS) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = l;
				depthEl.elem.append(o);
			}

			depthEl.elem.value = prev.sampleDepth || '0-6 in';

			new FormLabel({ appendTo: container, textContent: 'Results' });

			const gridEl = new ResultsGrid({ appendTo: container });

			const makeNum = (label, key, unit = '') => {
				const cell = new Elem({ tag: 'div', appendTo: gridEl });
				new FormLabel({ appendTo: cell, textContent: unit ? `${label} (${unit})` : label });
				const el = new Input({
					appendTo: cell,
					attributes: { type: 'number', step: 'any', placeholder: '—' },
				});

				el.elem.value = prev[key] != null && prev[key] !== '' ? String(prev[key]) : '';
				return el;
			};

			const omEl = makeNum('Organic Matter', 'organicMatter', '%');
			const respEl = makeNum('Respiration', 'soilRespiration', 'mg CO₂/g');
			const phEl = makeNum('pH', 'pH');
			const brayPEl = makeNum('Bray P', 'brayP', 'ppm');
			const potassiumEl = makeNum('Potassium', 'potassium', 'ppm');
			const cecEl = makeNum('CEC', 'cec', 'meq/100g');
			const nitrateEl = makeNum('Nitrate', 'nitrate', 'ppm');

			new FormLabel({ appendTo: container, textContent: 'Lab Cost ($)' });
			const labCostEl = new Input({
				appendTo: container,
				attributes: { type: 'number', step: '0.01', placeholder: 'Total cost for this test' },
			});

			labCostEl.elem.value = prev.labCost || '';

			// Properties bag — any lab result or custom field not covered above
			const KNOWN = new Set([
				'lab',
				'timing',
				'sampleDepth',
				'organicMatter',
				'soilRespiration',
				'pH',
				'brayP',
				'potassium',
				'cec',
				'nitrate',
				'labCost',
			]);
			const prevProps = Object.fromEntries(Object.entries(prev).filter(([k]) => !KNOWN.has(k)));
			const { collect: collectSoilProps } = makePropertiesEditor(container, prevProps);

			const numVal = el => (el.elem.value !== '' ? Number(el.elem.value) : null);

			g.name = () => {
				const t = TIMING_OPTS.find(o => o.value === timingEl.elem.value)?.label || timingEl.elem.value;
				const lab = labEl.elem.value.trim();
				return `Soil Test — ${t}${lab ? ` (${lab})` : ''}`;
			};
			g.details = () => ({
				...collectSoilProps(),
				lab: labEl.elem.value.trim() || null,
				timing: timingEl.elem.value,
				sampleDepth: depthEl.elem.value,
				organicMatter: numVal(omEl),
				soilRespiration: numVal(respEl),
				pH: numVal(phEl),
				brayP: numVal(brayPEl),
				potassium: numVal(potassiumEl),
				cec: numVal(cecEl),
				nitrate: numVal(nitrateEl),
				labCost: numVal(labCostEl),
			});
		} else {
			new FormLabel({ appendTo: container, textContent: 'Type' });
			const typeEl = new Select({ appendTo: container });

			for (const { value: v, label: l } of OBS_TYPES) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = l;
				typeEl.elem.append(o);
			}

			typeEl.elem.value = prev.type || 'weed_pressure';

			const { collect: collectObsProps } = makePropertiesEditor(container, {
				description: prev.description || '',
				severity: prev.severity || '',
			});

			g.name = () => {
				const p = collectObsProps();
				return p.description || OBS_TYPES.find(t => t.value === typeEl.elem.value)?.label || 'Observation';
			};
			g.details = () => ({ type: typeEl.elem.value, ...collectObsProps() });
		}
	}

	_buildHarvestSection(container, prev, g) {
		buildHarvestSection(container, prev, g, { onEmojiRefresh: v => this._refreshEmoji?.(v) });
	}

	_buildCoverCropSection(container, prev, g) {
		buildCoverCropSection(container, prev, g);
	}

	_buildLivestockSection(container, prev, g) {
		new FormLabel({ appendTo: container, textContent: 'Species' });
		const speciesInput = new Input({
			appendTo: container,
			attributes: { placeholder: 'e.g. Angus cattle, Dorper sheep, Broiler chickens' },
			value: prev.species || '',
			suggestions: this._knownSpecies,
		});

		speciesInput.elem.addEventListener('input', () => this._refreshEmoji?.(speciesInput.elem.value));

		const row1 = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
		});

		new FormLabel({ appendTo: row1, textContent: 'Head Count' });
		const headEl = new Input({ appendTo: row1, attributes: { type: 'number', min: '1' } });

		headEl.elem.value = prev.headCount || '';

		new FormLabel({ appendTo: row1, textContent: 'Entry Wt (lbs/head)' });
		const entryWtEl = new Input({ appendTo: row1, attributes: { type: 'number' } });

		entryWtEl.elem.value = prev.entryWeight || '';

		const { collect: collectStockProps } = makePropertiesEditor(container, {
			stockingNotes: prev.stockingNotes || '',
		});

		g.name = () => `${speciesInput.elem.value}${headEl.elem.value ? ` (${headEl.elem.value})` : ''}`;
		g.details = () => ({
			species: speciesInput.elem.value,
			headCount: headEl.elem.value ? Number(headEl.elem.value) : null,
			entryWeight: entryWtEl.elem.value ? Number(entryWtEl.elem.value) : null,
			...collectStockProps(),
		});
	}

	_collectData() {
		const fieldId = this._getters.fieldId?.();
		const date = this._getters.date?.();

		if (!fieldId || !date) return null;

		const category = this._getters.category?.();
		const name = this._detailGetters?.name?.() || '';
		const emojiOverride = this._getters.emoji?.();
		const autoEmoji = detectEmoji(category, name);

		return {
			fieldId,
			date,
			season: this._getters.season?.(),
			category,
			name,
			emoji: emojiOverride !== autoEmoji ? emojiOverride : '',
			details: this._detailGetters?.details?.() || {},
			notes: this._getters.notes?.() || '',
		};
	}
}
