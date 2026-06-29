import { Dialog, Elem, Form, conditionalList } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

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

export default class MaintenanceScheduleDialog extends Dialog {
	_form = null;

	constructor(options = {}) {
		const isEdit = !!options.schedule?.id;
		const schedule = options.schedule || {};
		const equipment = options.equipment || {};

		super({
			size: 'large',
			header: isEdit ? `Edit Schedule — ${schedule.name}` : `Add Schedule — ${equipment.name || 'Equipment'}`,
			buttons: conditionalList([{ alwaysItem: 'Save' }, { if: isEdit, thenItem: 'Delete' }, { alwaysItem: 'Cancel' }]),
			onButtonPress: ({ button }) => {
				if (button === 'Save') {
					const d = this._form.options.data;
					options.onSave?.({
						equipmentId: equipment.id,
						name: d.name,
						procedure: d.procedure,
						intervalUsage: toNum(d.intervalUsage),
						intervalDays: toNum(d.intervalDays),
						lastDoneDate: d.lastDoneDate || null,
						lastDoneUsage: toNum(d.lastDoneUsage),
						properties: collectProps(),
					});
				} else if (button === 'Delete') {
					options.onDelete?.();
				}

				this.close();
			},
			...options,
		});

		// Template picker
		let tplSelect;

		if (!isEdit) {
			new Elem({
				tag: 'label',
				appendTo: this.body,
				textContent: 'Start from template (optional)',
				style: {
					display: 'block',
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.06em',
					color: 'rgba(255,255,255,0.4)',
					marginTop: '12px',
					marginBottom: '4px',
				},
			});
			tplSelect = new Elem({
				tag: 'select',
				appendTo: this.body,
				style: {
					display: 'block',
					width: '100%',
					boxSizing: 'border-box',
					background: 'rgba(255,255,255,0.07)',
					border: '1px solid rgba(255,255,255,0.12)',
					borderRadius: '4px',
					color: '#fff',
					fontSize: '14px',
					padding: '8px 10px',
					fontFamily: 'inherit',
					cursor: 'pointer',
				},
			});

			const blankOpt = document.createElement('option');

			blankOpt.value = '';
			blankOpt.textContent = '— blank —';
			tplSelect.elem.append(blankOpt);

			for (const t of COMMON_SCHEDULES) {
				const opt = document.createElement('option');

				opt.value = t.name;
				opt.textContent = t.name;
				tplSelect.elem.append(opt);
			}
		}

		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '10px', marginBottom: '2px' },
			textContent: 'Set one or both interval types — whichever comes first triggers the reminder',
		});

		const unit = equipment.usageUnit || '';

		this._form = new Form({
			appendTo: this.body,
			data: {
				name: schedule.name || '',
				intervalUsage: schedule.intervalUsage || '',
				intervalDays: schedule.intervalDays || '',
				lastDoneDate: schedule.lastDoneDate || '',
				lastDoneUsage: schedule.lastDoneUsage || '',
				procedure: schedule.procedure || '',
			},
			inputs: [
				{
					key: 'name',
					label: 'Schedule Name',
					type: 'text',
					placeholder: 'e.g. Oil Change, Annual Inspection',
					validate: v => (v ? null : 'Name is required'),
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
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
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
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
			],
		});

		if (isEdit)
			this._form.addCleanup('conflictWatch', watchFormConflicts(this._form, 'maintenance-schedules', schedule.id));

		// Wire template picker to fill Form fields
		if (!isEdit && tplSelect) {
			tplSelect.elem.addEventListener('change', () => {
				const tpl = COMMON_SCHEDULES.find(t => t.name === tplSelect.elem.value);

				if (!tpl) return;
				['name', 'procedure'].forEach(k => {
					this._form.inputElements[k].options.value = tpl[k] || '';
					this._form.options.data[k] = tpl[k] || '';
				});
				if (tpl.intervalHours) {
					this._form.inputElements.intervalUsage.options.value = tpl.intervalHours;
					this._form.options.data.intervalUsage = tpl.intervalHours;
				}
				if (tpl.intervalDays) {
					this._form.inputElements.intervalDays.options.value = tpl.intervalDays;
					this._form.options.data.intervalDays = tpl.intervalDays;
				}
			});
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, schedule.properties || {});
	}
}
