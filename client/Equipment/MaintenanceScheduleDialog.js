import { Elem, FormDialog, Select, theme } from '@vanilla-bean/components';

import { PropertiesField } from '../utils/formFields';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';

const { colors, space } = theme;

const COMMON_SCHEDULES = [
	{
		name: 'Engine Oil Change',
		procedure: 'Drain engine oil, replace oil filter, fill with fresh oil to spec.',
		intervalHours: 250,
	},
	{
		name: 'Air Filter',
		procedure: 'Inspect primary and secondary air filters. Replace if clogged or damaged.',
		intervalHours: 250,
	},
	{ name: 'Fuel Filter', procedure: 'Replace primary and secondary fuel filters.', intervalHours: 500 },
	{
		name: 'Hydraulic Filter',
		procedure: 'Replace hydraulic oil filter. Check hydraulic oil level and condition.',
		intervalHours: 500,
	},
	{
		name: 'Grease All Joints',
		procedure: 'Grease all zerk fittings per operator manual. Check drivelines.',
		intervalHours: 50,
	},
	{
		name: 'Coolant Service',
		procedure: 'Check coolant level and freeze protection. Flush and replace per schedule.',
		intervalDays: 730,
	},
	{
		name: 'Annual Inspection',
		procedure: 'Full pre-season inspection: belts, hoses, tires, lights, brakes, fluids.',
		intervalDays: 365,
	},
	{ name: 'Tire Check', procedure: 'Check tire pressure and tread condition.', intervalDays: 30 },
	{ name: 'Battery Service', procedure: 'Clean terminals, check charge and electrolyte level.', intervalDays: 180 },
];

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class MaintenanceScheduleDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.schedule?.id;
		const schedule = options.schedule || {};
		const equipment = options.equipment || {};

		const unit = equipment.usageUnit || '';

		super({
			header: isEdit ? `Edit Schedule — ${schedule.name}` : `Add Schedule — ${equipment.name || 'Equipment'}`,
			data: {
				name: schedule.name || '',
				intervalUsage: schedule.intervalUsage || '',
				intervalDays: schedule.intervalDays || '',
				lastDoneDate: schedule.lastDoneDate || '',
				lastDoneUsage: schedule.lastDoneUsage || '',
				procedure: schedule.procedure || '',
				template: '',
				props: schedule.properties || {},
			},
			inputs: [
				// A new schedule can start from a common one, which fills in its fields
				...(isEdit
					? []
					: [
							{
								key: 'template',
								label: 'Start from template (optional)',
								InputComponent: Select,
								options: [{ value: '', label: '— blank —' }, ...COMMON_SCHEDULES.map(t => t.name)],
								onChange: ({ value }) => this._applyTemplate(value),
							},
						]),
				{
					key: 'name',
					label: 'Schedule Name',
					type: 'text',
					placeholder: 'e.g. Oil Change, Annual Inspection',
					validate: v => (v ? null : 'Name is required'),
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{
							key: 'intervalUsage',
							label: unit ? `Every N ${unit}` : 'Every N Usage Units',
							type: 'number',
							attributes: { step: '1' },
							placeholder: 'e.g. 250',
						},
						{
							key: 'intervalDays',
							label: 'Every N Days',
							type: 'number',
							attributes: { step: '1' },
							placeholder: 'e.g. 365',
						},
					],
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.sm },
					inputs: [
						{ key: 'lastDoneDate', label: 'Last Done Date', type: 'date' },
						{
							key: 'lastDoneUsage',
							label: unit ? `${unit} at Last Service` : 'Usage at Last Service',
							type: 'number',
							attributes: { step: '0.1' },
							placeholder: equipment.usage ? `${equipment.usage}${unit ? ' ' + unit : ''}` : '',
						},
					],
				},
				{
					key: 'procedure',
					label: 'Procedure',
					tag: 'textarea',
					rows: 3,
					placeholder: 'Step-by-step procedure, specs, torque values…',
				},
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },
			],
			onSave: async d => {
				return stayOpenFor(
					await options.onSave?.({
						equipmentId: equipment.id,
						name: d.name,
						procedure: d.procedure,
						intervalUsage: toNum(d.intervalUsage),
						intervalDays: toNum(d.intervalDays),
						lastDoneDate: d.lastDoneDate || null,
						lastDoneUsage: toNum(d.lastDoneUsage),
						properties: d.props,
					}),
				);
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete the "${schedule.name || 'maintenance'}" schedule?` },
			}),
			...withoutCallbacks(options),
		});

		new Elem({
			tag: 'div',
			appendTo: this.intro,
			style: { fontSize: '11px', color: colors.muted, marginTop: space.md, marginBottom: space.xs },
			textContent: 'Set one or both interval types — whichever comes first triggers the reminder',
		});

		if (isEdit)
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'maintenance-schedules', schedule.id));
	}

	// Fills the fields from the common schedule picked
	_applyTemplate(name) {
		const tpl = COMMON_SCHEDULES.find(t => t.name === name);
		const data = this.form.options.data;

		if (!tpl) return;

		data.name = tpl.name || '';
		data.procedure = tpl.procedure || '';
		if (tpl.intervalHours) data.intervalUsage = tpl.intervalHours;
		if (tpl.intervalDays) data.intervalDays = tpl.intervalDays;
	}
}
