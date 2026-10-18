import { FormDialog, Select, Notify } from '@vanilla-bean/components';

import { getFields } from '../api';
import { createApplicationLog, updateApplicationLog, deleteApplicationLog } from '../api/applicationLogs';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { toNum } from '../utils/format.js';

export const CATEGORIES = [
	{ value: 'herbicide', label: 'Herbicide', color: '#4caf50' },
	{ value: 'insecticide', label: 'Insecticide', color: '#e8832a' },
	{ value: 'fungicide', label: 'Fungicide', color: '#9c6de8' },
	{ value: 'fertilizer', label: 'Fertilizer', color: '#4a90d9' },
	{ value: 'adjuvant', label: 'Adjuvant/Surfactant', color: '#e8c42a' },
	{ value: 'fuel', label: 'Fuel', color: '#888' },
	{ value: 'other', label: 'Other', color: '#9e9e9e' },
];

export const RATE_UNITS = ['oz/ac', 'fl oz/ac', 'lbs/ac', 'gal/ac', 'pts/ac', 'qts/ac', 'tons/ac', 'mL/ac'];

export const METHODS = [
	'Ground sprayer (broadcast)',
	'Ground sprayer (band)',
	'Ground sprayer (spot)',
	'Aerial (fixed-wing)',
	'Aerial (helicopter / drone)',
	'Backpack / handheld sprayer',
	'Irrigation (chemigation)',
	'Soil injection',
	'Soil incorporation',
	'Seed treatment',
	'Dry broadcast spreader',
	'Other',
];

const PESTICIDE_CATEGORIES = new Set(['herbicide', 'insecticide', 'fungicide']);

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class ApplicationLogDialog extends FormDialog {
	constructor(options = {}) {
		const isNew = !options.record;
		const rec = options.record || {};
		// The inputs' handlers reach the dialog, which exists once super() returns
		const self = {};

		super({
			size: 'large',
			header: isNew ? 'Log Application' : 'Edit Application Record',
			data: {
				date: rec.date || new Date().toISOString().slice(0, 10),
				fieldId: rec.fieldId || '',
				acresTreated: rec.acresTreated || '',
				category: rec.category || 'herbicide',
				product: rec.product || '',
				epaRegNumber: rec.epaRegNumber || '',
				activeIngredients: rec.activeIngredients || '',
				rate: rec.rate || '',
				rateUnit: rec.rateUnit || 'oz/ac',
				totalApplied: rec.totalApplied || '',
				totalUnit: rec.totalUnit || 'oz',
				method: rec.method || '',
				targetPest: rec.targetPest || '',
				rei: rec.rei || '',
				phi: rec.phi || '',
				operatorName: rec.operatorName || '',
				operatorLicense: rec.operatorLicense || '',
				windSpeed: rec.windSpeed || '',
				temperature: rec.temperature || '',
				notes: rec.notes || '',
			},
			inputs: [
				// Row 1 — date, field, acres
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'date',
							label: 'Date *',
							type: 'date',
							validate: v => (String(v ?? '').trim() ? null : 'Date is required'),
						},
						{ key: 'fieldId', label: 'Field', InputComponent: Select, options: [{ label: '— select —', value: '' }] },
						{
							key: 'acresTreated',
							label: 'Acres treated',
							type: 'number',
							placeholder: '0.0',
							onChange: () => self.dialog._recalculateTotal(),
						},
					],
				},
				// Row 2 — category, product
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'category',
							label: 'Category *',
							InputComponent: Select,
							options: CATEGORIES.map(c => ({ value: c.value, label: c.label })),
						},
						{
							key: 'product',
							label: 'Product name *',
							placeholder: 'e.g. Roundup PowerMAX',
							validate: v => (v?.trim() ? null : 'Product name is required'),
						},
					],
				},
				// Row 3 — EPA reg, active ingredients
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'epaRegNumber', label: 'EPA Reg. # (NNNNN-NNNNN)', placeholder: '12345-67890' },
						{ key: 'activeIngredients', label: 'Active ingredient(s)', placeholder: 'e.g. Glyphosate 48.7%' },
					],
				},
				// Row 4 — rate, rateUnit, totalApplied, totalUnit
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '120px 140px 1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'rate',
							label: 'Rate *',
							type: 'number',
							placeholder: '22',
							onChange: () => self.dialog._recalculateTotal(),
						},
						{
							key: 'rateUnit',
							label: 'Per acre unit',
							InputComponent: Select,
							options: RATE_UNITS.map(u => ({ value: u, label: u })),
						},
						{
							key: 'totalApplied',
							label: 'Total applied',
							type: 'number',
							placeholder: 'auto',
							onChange: e => {
								self.dialog._manualTotal = !!e.value;
							},
						},
						{
							key: 'totalUnit',
							label: 'Total unit',
							InputComponent: Select,
							options: ['oz', 'fl oz', 'lbs', 'gal', 'pts', 'qts', 'tons', 'mL'].map(u => ({ value: u, label: u })),
						},
					],
				},
				// Method (full width)
				{
					key: 'method',
					label: 'Method',
					InputComponent: Select,
					options: [{ value: '', label: '— select —' }, ...METHODS.map(m => ({ value: m, label: m }))],
				},
				// Target pest (full width)
				{ key: 'targetPest', label: 'Target pest / weed / disease', placeholder: 'e.g. broadleaf weeds, early blight' },
				// Row 5 — REI + PHI (pesticide categories only)
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'rei',
							label: 'Re-entry interval — REI (hours)',
							type: 'number',
							placeholder: 'from label',
							condition: data => PESTICIDE_CATEGORIES.has(data.category),
						},
						{
							key: 'phi',
							label: 'Pre-harvest interval — PHI (days)',
							type: 'number',
							placeholder: 'from label',
							condition: data => PESTICIDE_CATEGORIES.has(data.category),
						},
					],
				},
				// Row 6 — operator name, license
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'operatorName', label: 'Certified applicator name', placeholder: 'Full name' },
						{ key: 'operatorLicense', label: 'License / cert. number', placeholder: 'License #' },
					],
				},
				// Row 7 — wind speed, temperature
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'windSpeed', label: 'Wind speed (mph)', type: 'number', placeholder: '0–10 ideal' },
						{ key: 'temperature', label: 'Temperature (°F)', type: 'number', placeholder: '' },
					],
				},
				// Notes (full width)
				{
					key: 'notes',
					label: 'Notes',
					tag: 'textarea',
					rows: 2,
					placeholder: 'Any additional notes for the compliance record…',
				},
			],
			onSave: d => self.dialog._save(d, rec.id, rec._v, isNew, options),
			...(!isNew && {
				confirmDelete: { header: `Delete the ${rec.product || 'application'} record?` },
				onDelete: async () => {
					try {
						await deleteApplicationLog(rec.id);
						options.onDelete?.();

						return true;
					} catch (err) {
						new Notify({ type: 'error', textContent: err.message || 'Delete failed', timeout: 4000 });

						return false;
					}
				},
			}),
			...withoutCallbacks(options),
		});

		self.dialog = this;
		this._manualTotal = false;

		if (!isNew) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'application-logs', rec.id));
		}

		// Async-populate the field Select after Form is rendered
		getFields()
			.then(d => {
				const fieldSelect = this.form.inputElements.fieldId;
				const opts = [
					{ label: '— select —', value: '' },
					...Object.values(d?.body || {})
						.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
						.map(f => ({ label: f.name || 'Unnamed', value: f.id })),
				];
				fieldSelect.options.options = opts;
				fieldSelect.options.value = rec.fieldId || options.fieldId || '';
			})
			.catch(() => {});
	}

	_recalculateTotal() {
		if (this._manualTotal) return;
		const d = this.form.options.data;
		const r = parseFloat(d.rate);
		const a = parseFloat(d.acresTreated);
		if (r > 0 && a > 0) {
			const total = (r * a).toFixed(2);
			this.form.inputElements.totalApplied.options.value = total;
			this.form.options.data.totalApplied = total;
		}
	}

	// FormDialog's save: false keeps the dialog open with what was typed
	async _save(d, id, _v, isNew, options) {
		const body = {
			date: d.date,
			fieldId: d.fieldId || null,
			acresTreated: toNum(d.acresTreated),
			category: d.category,
			product: d.product.trim(),
			epaRegNumber: d.epaRegNumber?.trim() || null,
			activeIngredients: d.activeIngredients?.trim() || null,
			rate: toNum(d.rate),
			rateUnit: d.rateUnit || null,
			totalApplied: toNum(d.totalApplied),
			totalUnit: d.totalUnit || null,
			method: d.method || null,
			targetPest: d.targetPest?.trim() || null,
			rei: toNum(d.rei),
			phi: toNum(d.phi),
			operatorName: d.operatorName?.trim() || null,
			operatorLicense: d.operatorLicense?.trim() || null,
			windSpeed: toNum(d.windSpeed),
			temperature: toNum(d.temperature),
			notes: d.notes?.trim() || null,
		};

		try {
			if (isNew) {
				const result = await createApplicationLog({ body });
				options.onSave?.(result?.body);
			} else {
				const result = await updateApplicationLog(id, { body: { ...body, _v } });
				options.onSave?.(result?.body);
			}

			return true;
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Save failed', timeout: 4000 });

			return false;
		}
	}
}
