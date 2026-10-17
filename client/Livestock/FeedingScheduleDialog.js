import { FormDialog, Elem, Select } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

import { getSupplies } from '../api';

export const FEED_TYPES = [
	'Hay — Grass',
	'Hay — Alfalfa',
	'Hay — Mixed',
	'Hay — Brome',
	'Silage — Corn',
	'Silage — Hay',
	'Haylage',
	'Grain — Corn',
	'Grain — Oats',
	'Grain — Barley',
	'Creep Feed',
	'Protein Supplement',
	'Mineral Block',
	'Loose Mineral',
	'Salt',
	'Distillers Grains',
	'Range Cake',
	'Liquid Feed',
	'Pellets',
	'Pasture Only',
	'Stockpiled Forage',
];

export const FREQUENCIES = [
	{ value: '4x_daily', label: '4× daily', daysInterval: 0.25 },
	{ value: '3x_daily', label: '3× daily', daysInterval: 0.33 },
	{ value: 'twice_daily', label: 'Twice daily', daysInterval: 0.5 },
	{ value: 'once_daily', label: 'Once daily', daysInterval: 1 },
	{ value: 'every_other', label: 'Every other day', daysInterval: 2 },
	{ value: '3x_week', label: '3× per week', daysInterval: 2.33 },
	{ value: 'twice_week', label: 'Twice per week', daysInterval: 3.5 },
	{ value: 'weekly', label: 'Weekly', daysInterval: 7 },
	{ value: 'free_choice', label: 'Free choice (always available)', daysInterval: null },
	{ value: 'as_needed', label: 'As needed', daysInterval: null },
];

export const AMOUNT_UNITS = [
	'lbs/hd',
	'lbs total',
	'tons/hd',
	'tons total',
	'bales',
	'flakes',
	'lbs/100 lbs BW',
	'oz/hd',
	'free choice',
];

export const frequencyLabel = f => FREQUENCIES.find(x => x.value === f)?.label || f;
export const frequencyInterval = f => FREQUENCIES.find(x => x.value === f)?.daysInterval ?? null;

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class FeedingScheduleDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.schedule?.id;
		const schedule = options.schedule || {};

		const feedTypeDatalistId = `fs-feed-${Math.random().toString(36).slice(2)}`;

		const unitDatalistId = `fs-unit-${Math.random().toString(36).slice(2)}`;

		super({
			size: 'large',
			header: isEdit ? `Edit Feeding — ${schedule.feedType || 'Feed'}` : 'Add Feeding Schedule',
			data: {
				feedType: schedule.feedType || '',
				amountPerHead: schedule.amountPerHead || '',
				amountUnit: schedule.amountUnit || 'lbs/hd',
				frequency: schedule.frequency || 'once_daily',
				supplyId: schedule.supplyId || '',
			},
			inputs: [
				{
					key: 'feedType',
					label: 'Feed Type',
					type: 'text',
					placeholder: 'e.g. Hay — Alfalfa, Corn Silage, Mineral Block',
					attributes: { list: feedTypeDatalistId },
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'amountPerHead',
							label: 'Amount',
							type: 'number',
							attributes: { step: '0.1' },
							placeholder: 'e.g. 25',
						},
						{
							key: 'amountUnit',
							label: 'Unit',
							type: 'text',
							placeholder: 'lbs/hd, bales, etc.',
							attributes: { list: unitDatalistId },
						},
					],
				},
				{
					key: 'frequency',
					label: 'Frequency',
					InputComponent: Select,
					options: FREQUENCIES.map(({ value, label }) => ({ value, label })),
				},
				{
					key: 'supplyId',
					label: 'From inventory (optional)',
					InputComponent: Select,
					options: [{ label: '— not tracked in inventory —', value: '' }],
				},
			],
			onSave: async d => {
				await options.onSave?.({
					fieldId: options.fieldId || schedule.fieldId || '',
					eventId: options.eventId || schedule.eventId || '',
					feedType: d.feedType,
					amountPerHead: toNum(d.amountPerHead),
					amountUnit: d.amountUnit,
					frequency: d.frequency,
					supplyId: d.supplyId || null,
					properties: collectProps(),
				});
			},
			...(isEdit && { onDelete: async () => options.onDelete?.() }),
			...withoutCallbacks(options),
		});

		// Feed type datalist
		const feedTypeDatalist = new Elem({ tag: 'datalist', appendTo: this.body });

		feedTypeDatalist.elem.id = feedTypeDatalistId;
		FEED_TYPES.forEach(t => {
			const o = document.createElement('option');
			o.value = t;
			feedTypeDatalist.elem.append(o);
		});

		// Unit datalist
		const unitDatalist = new Elem({ tag: 'datalist', appendTo: this.body });

		unitDatalist.elem.id = unitDatalistId;
		AMOUNT_UNITS.forEach(u => {
			const o = document.createElement('option');
			o.value = u;
			unitDatalist.elem.append(o);
		});

		if (isEdit) this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'feeding-schedules', schedule.id));

		// Async-load feed supplies
		getSupplies()
			.then(data => {
				const feedSupplies = Object.values(data?.body || {})
					.filter(s =>
						/hay|grain|feed|supplement|mineral|silage|forage|oat|corn|barley/i.test(s.category || s.name || ''),
					)
					.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
				const opts = [
					{ label: '— not tracked in inventory —', value: '' },
					...feedSupplies.map(s => ({
						value: s.id,
						label: `${s.name}${s.costPerUnit ? ` ($${Number(s.costPerUnit).toFixed(2)}/${s.unit || 'unit'})` : ''}`,
					})),
				];

				this.form.inputElements.supplyId.options.options = opts;
				if (schedule.supplyId) this.form.inputElements.supplyId.options.value = schedule.supplyId;
			})
			.catch(() => {});

		const { collect: collectProps } = makePropertiesEditor(this.body, schedule.properties || {});
	}
}
