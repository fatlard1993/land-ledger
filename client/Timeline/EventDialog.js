import { FormDialog, parseDate, Select, theme } from '@vanilla-bean/components';

import { EVENT_CATEGORIES, categoryMeta } from '../eventCategories';
import { getFields } from '../api';
import { getCropSuggestions } from '../api/cropSuggestions';
import { stayOpenFor } from '../utils/stayOpenFor';
import { emojiInput, numberField, PropertiesField } from '../utils/formFields';
import { toDateOnly } from '../utils/dates';
import { toNum } from '../utils/format.js';
import { harvestData, harvestInputs, harvestRecord } from './HarvestSection.js';
import { coverCropData, coverCropInputs, coverCropRecord } from './CoverCropSection.js';

// A supply as a Select option: its name, with its cost per unit
const supplyOption = s => ({
	value: s.id,
	label: `${s.name} ($${Number(s.costPerUnit || 0).toFixed(2)}/${s.unit || 'unit'})`,
});

const { space } = theme;

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

// A soil test's results, each a number field of its own
const SOIL_RESULTS = [
	{ key: 'organicMatter', label: 'Organic Matter (%)' },
	{ key: 'soilRespiration', label: 'Respiration (mg CO₂/g)' },
	{ key: 'pH', label: 'pH' },
	{ key: 'brayP', label: 'Bray P (ppm)' },
	{ key: 'potassium', label: 'Potassium (ppm)' },
	{ key: 'cec', label: 'CEC (meq/100g)' },
	{ key: 'nitrate', label: 'Nitrate (ppm)' },
];

// What a soil test keeps as fields of its own; anything else it holds is a property
const SOIL_KNOWN = new Set(['lab', 'timing', 'sampleDepth', ...SOIL_RESULTS.map(({ key }) => key), 'labCost']);

// The categories with details of their own; any other is an observation
const DETAILED = ['crop', 'harvest', 'cover_crop', 'livestock', 'input', 'tillage', 'soil_test'];

const is = category => data => data.category === category;
const isObservation = data => !DETAILED.includes(data.category);

const COMMON_SPECIES = [
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
];

const MANUAL_SEED = { value: '', label: '— enter cost manually —' };
const MANUAL_SUPPLY = { value: '', label: '— enter manually —' };
const INPUT_SUPPLY_CATEGORIES = ['herbicide', 'fertilizer', 'amendment', 'fungicide', 'insecticide', 'other'];

const filled = value => (value != null && value !== '' ? String(value) : '');
const numVal = value => (value !== '' && value != null ? Number(value) : null);

const parseDetails = raw => {
	try {
		return (typeof raw === 'string' ? JSON.parse(raw) : raw) || {};
	} catch {
		return {};
	}
};

// Every category's fields as they start. Each starts from the details the event was saved with, as the details built
// for a category did when picking one rebuilt them
const startingData = (event, fieldId, prev) => {
	const category = event.category || 'crop';

	return {
		fieldId,
		category,
		emoji: event.emoji || detectEmoji(category, ''),
		date: event.date || toDateOnly(),

		cropSpecies: prev.species || '',
		cropSeedSupply: '',
		cropSeedCost: prev.seedCostPerAcre || '',
		cropProps: { variety: prev.variety || '', seedingRate: prev.seedingRate || '' },

		...harvestData(prev),
		...coverCropData(prev),

		lsSpecies: prev.species || '',
		lsHead: prev.headCount || '',
		lsEntryWt: prev.entryWeight || '',
		lsProps: { stockingNotes: prev.stockingNotes || '' },

		inType: prev.inputType || 'herbicide',
		inProduct: prev.product || '',
		inRate: prev.rate || '',
		inCost: prev.costPerAcre || '',
		inSupply: '',

		tilType: prev.type || 'no_till',
		tilCost: prev.costPerAcre || '',
		tilProps: { depth: prev.depth != null ? String(prev.depth) : '', equipment: prev.equipment || '' },

		soilLab: prev.lab || '',
		soilTiming: prev.timing || 'pre-season',
		soilDepth: prev.sampleDepth || '0-6 in',
		...Object.fromEntries(SOIL_RESULTS.map(({ key }) => [`soil_${key}`, filled(prev[key])])),
		soilLabCost: prev.labCost || '',
		soilProps: Object.fromEntries(Object.entries(prev).filter(([key]) => !SOIL_KNOWN.has(key))),

		obsType: prev.type || 'weed_pressure',
		obsProps: { description: prev.description || '', severity: prev.severity || '' },

		notes: event.notes || '',
	};
};

// A category's name and details, as the event saves them
const RECORDS = {
	crop: data => ({
		name: `${data.cropSpecies}${data.cropProps.variety ? ` — ${data.cropProps.variety}` : ''}`,
		details: {
			...data.cropProps,
			species: data.cropSpecies,
			seedCostPerAcre: toNum(data.cropSeedCost),
			seedSupplyId: data.cropSeedSupply || null,
		},
	}),
	harvest: harvestRecord,
	cover_crop: coverCropRecord,
	livestock: data => ({
		name: `${data.lsSpecies}${data.lsHead !== '' ? ` (${data.lsHead})` : ''}`,
		details: {
			species: data.lsSpecies,
			headCount: toNum(data.lsHead),
			entryWeight: toNum(data.lsEntryWt),
			...data.lsProps,
		},
	}),
	input: data => ({
		name: data.inProduct || data.inType,
		details: {
			inputType: data.inType,
			product: data.inProduct,
			rate: data.inRate,
			costPerAcre: toNum(data.inCost),
			supplyId: data.inSupply || null,
		},
	}),
	tillage: data => ({
		name: TILLAGE_TYPES.find(t => t.value === data.tilType)?.label || data.tilType,
		details: { ...data.tilProps, type: data.tilType, costPerAcre: toNum(data.tilCost) },
	}),
	soil_test: data => {
		const timing = TIMING_OPTS.find(o => o.value === data.soilTiming)?.label || data.soilTiming;
		const lab = data.soilLab.trim();

		return {
			name: `Soil Test — ${timing}${lab ? ` (${lab})` : ''}`,
			details: {
				...data.soilProps,
				lab: lab || null,
				timing: data.soilTiming,
				sampleDepth: data.soilDepth,
				...Object.fromEntries(SOIL_RESULTS.map(({ key }) => [key, numVal(data[`soil_${key}`])])),
				labCost: numVal(data.soilLabCost),
			},
		};
	},
	observation: data => ({
		name: data.obsProps.description || OBS_TYPES.find(t => t.value === data.obsType)?.label || 'Observation',
		details: { type: data.obsType, ...data.obsProps },
	}),
};

export const eventRecord = data => (RECORDS[data.category] ?? RECORDS.observation)(data);

export default class EventDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.event?.id;
		const event = options.event || {};
		const fieldId = options.fieldId || event.fieldId || '';
		const prev = parseDetails(event.details);

		const form = () => this.form;
		const field = key => this.form.inputElements[key];
		const data = () => this.form.options.data;
		// The emoji guessed from what's typed in the field that names the event, unless one has been typed
		const refreshEmoji = name => (field('emoji').options.auto = detectEmoji(data().category, name));
		const half = inputs => ({
			type: 'group',
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
			inputs,
		});

		super({
			header: isEdit ? 'Edit Event' : 'Log Event',
			data: startingData(event, fieldId, prev),
			inputs: [
				{
					key: 'fieldId',
					label: 'Field',
					InputComponent: Select,
					options: [],
					validate: value => (value ? null : 'Choose a field'),
					onChange: ({ value }) => (this._acreage = this._fields?.find(f => f.value === value)?.acreage || 0),
				},
				{
					key: 'category',
					label: 'Category',
					InputComponent: Select,
					options: EVENT_CATEGORIES.map(({ value, label }) => ({ value, label })),
					onChange: ({ value }) => (field('emoji').options.auto = detectEmoji(value, '')),
				},
				emojiInput('emoji', { title: 'Tap to change emoji — auto-detected from event name' }),
				{ key: 'date', label: 'Date', type: 'date', validate: value => (value ? null : 'Choose a date') },

				// Crop
				{
					key: 'cropSpecies',
					label: 'Crop',
					condition: is('crop'),
					placeholder: 'e.g. Corn, Winter Wheat, Grain Sorghum…',
					onInput: ({ value }) => refreshEmoji(value),
				},
				{
					key: 'cropSeedSupply',
					label: 'Seed from inventory (optional)',
					condition: is('crop'),
					InputComponent: Select,
					options: [MANUAL_SEED],
				},
				{
					key: 'cropSeedCost',
					label: 'Seed Cost/Acre ($)',
					condition: is('crop'),
					placeholder: 'Optional',
					...numberField({ step: '0.01' }),
				},
				{ key: 'cropProps', label: 'Properties', condition: is('crop'), InputComponent: PropertiesField },

				...harvestInputs({ form, onEmojiRefresh: refreshEmoji }),
				...coverCropInputs(),

				// Stock
				{
					key: 'lsSpecies',
					label: 'Species',
					condition: is('livestock'),
					placeholder: 'e.g. Angus cattle, Dorper sheep, Broiler chickens',
					suggestions: COMMON_SPECIES,
					onInput: ({ value }) => refreshEmoji(value),
				},
				half([
					{
						key: 'lsHead',
						label: 'Head Count',
						condition: is('livestock'),
						...numberField({ min: '1' }),
					},
					{ key: 'lsEntryWt', label: 'Entry Wt (lbs/head)', condition: is('livestock'), ...numberField() },
				]),
				{ key: 'lsProps', label: 'Properties', condition: is('livestock'), InputComponent: PropertiesField },

				// Input
				{ key: 'inType', label: 'Type', condition: is('input'), InputComponent: Select, options: INPUT_TYPES },
				{ key: 'inProduct', label: 'Product', condition: is('input'), placeholder: 'e.g. Roundup' },
				{
					key: 'inRate',
					label: 'Rate',
					condition: is('input'),
					placeholder: 'e.g. 22 oz/ac',
					// The cost follows the rate, at the cost per unit of the supply picked
					onInput: ({ value }) => {
						const supply = this._supplies?.get(data().inSupply);
						const rate = String(value).match(/[\d.]+/);

						if (supply?.costPerUnit && rate) data().inCost = (Number(rate[0]) * Number(supply.costPerUnit)).toFixed(2);
					},
				},
				{ key: 'inCost', label: 'Cost/Acre ($)', condition: is('input'), ...numberField({ step: '0.01' }) },
				{
					key: 'inSupply',
					label: 'From inventory (optional)',
					condition: is('input'),
					InputComponent: Select,
					options: [MANUAL_SUPPLY],
					// The supply picked names the product, and its unit is the rate's
					onChange: ({ value }) => {
						const supply = this._supplies?.get(value);

						if (!supply?.name) return;

						data().inProduct = supply.name;
						if (supply.unit) field('inRate').elem.placeholder = `amount per ac (${supply.unit}/ac)`;
					},
				},

				// Tillage
				{ key: 'tilType', label: 'Type', condition: is('tillage'), InputComponent: Select, options: TILLAGE_TYPES },
				{
					key: 'tilCost',
					label: 'Cost/Acre ($)',
					condition: is('tillage'),
					placeholder: 'Optional',
					...numberField({ step: '0.01' }),
				},
				{ key: 'tilProps', label: 'Properties', condition: is('tillage'), InputComponent: PropertiesField },

				// Soil test
				{ key: 'soilLab', label: 'Lab', condition: is('soil_test'), placeholder: 'e.g. Regen Ag, Ward Labs' },
				{
					key: 'soilTiming',
					label: 'Timing',
					condition: is('soil_test'),
					InputComponent: Select,
					options: TIMING_OPTS,
				},
				{
					key: 'soilDepth',
					label: 'Sample Depth',
					condition: is('soil_test'),
					InputComponent: Select,
					options: DEPTH_OPTS,
				},
				half(
					SOIL_RESULTS.map(({ key, label }) => ({
						key: `soil_${key}`,
						label,
						condition: is('soil_test'),
						placeholder: '—',
						...numberField({ step: 'any' }),
					})),
				),
				{
					key: 'soilLabCost',
					label: 'Lab Cost ($)',
					condition: is('soil_test'),
					placeholder: 'Total cost for this test',
					...numberField({ step: '0.01' }),
				},
				// Any lab result or custom field not covered above
				{ key: 'soilProps', label: 'Properties', condition: is('soil_test'), InputComponent: PropertiesField },

				// Observation, and any category without details of its own
				{ key: 'obsType', label: 'Type', condition: isObservation, InputComponent: Select, options: OBS_TYPES },
				{ key: 'obsProps', label: 'Properties', condition: isObservation, InputComponent: PropertiesField },

				{ key: 'notes', label: 'Notes', placeholder: 'Optional' },
			],
			onSave: async values => stayOpenFor(await options.onSave?.(this._collectData(values))),
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => stayOpenFor(await options.onDelete()),
					confirmDelete: { header: 'Delete this event?' },
				}),
			...withoutCallbacks(options),
		});

		this._event = event;
		this._fieldId = fieldId;
		this._acreage = options.acreage || 0;

		this._loadChoices(prev);
	}

	// The fields, supplies and suggestions the fields offer, filled in as they arrive
	async _loadChoices(prev) {
		const { inputElements } = this.form;
		const data = this.form.options.data;

		getCropSuggestions()
			.then(crops => (inputElements.cropSpecies.options.suggestions = crops))
			.catch(() => {
				/* suggestions unavailable — static list in use */
			});

		import('../api/supplies')
			.then(({ getSupplies }) => getSupplies())
			.then(result => {
				const supplies = Object.values(result?.body || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
				const seeds = supplies.filter(s => s.category === 'seed');
				const inputs = supplies.filter(s => INPUT_SUPPLY_CATEGORIES.includes(s.category));

				this._supplies = new Map(inputs.map(s => [s.id, s]));

				inputElements.cropSeedSupply.options.options = [MANUAL_SEED, ...seeds.map(supplyOption)];
				inputElements.inSupply.options.options = [MANUAL_SUPPLY, ...inputs.map(supplyOption)];

				// A supply since used up or deleted isn't listed, and stays unpicked
				if (seeds.some(seed => seed.id === prev.seedSupplyId)) data.cropSeedSupply = prev.seedSupplyId;
				if (inputs.some(supply => supply.id === prev.supplyId)) data.inSupply = prev.supplyId;
			})
			.catch(() => {
				/* supply list unavailable */
			});

		// Livestock species suggestions: the common ones, plus every species already logged
		const { getEvents } = await import('../api/events');
		const [eventsData, fieldsData] = await Promise.all([getEvents(), getFields()]);
		const knownSpecies = new Set(COMMON_SPECIES);

		for (const logged of Object.values(eventsData?.body || {})) {
			if (logged.category === 'livestock' && logged.name) knownSpecies.add(logged.name.split(/[—–,(]/)[0].trim());
		}

		inputElements.lsSpecies.options.suggestions = [...knownSpecies];

		this._fields = Object.values(fieldsData?.body || {}).map(f => ({
			value: f.id,
			label: f.name || 'Unnamed Field',
			acreage: f.acreage,
		}));

		inputElements.fieldId.options.options = this._fields.map(({ value, label }) => ({ value, label }));
		data.fieldId = this._fieldId || this._fields[0]?.value || '';
		inputElements.fieldId.options.value = data.fieldId;
	}

	_collectData(values = this.form.options.data) {
		const { fieldId, date, category, emoji: typed, notes } = values;
		const { name, details } = eventRecord(values);
		const emoji = typed || null;
		const parsed = parseDate(date);

		return {
			fieldId,
			date,
			season: parsed ? parsed.getFullYear() : new Date().getFullYear(),
			category,
			name,
			emoji: emoji !== detectEmoji(category, name) ? emoji : '',
			details,
			notes: notes || '',
		};
	}
}
