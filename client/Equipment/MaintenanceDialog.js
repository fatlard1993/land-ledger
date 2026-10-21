import { Button, Component, Elem, FormDialog, theme } from '@vanilla-bean/components';

import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';

const { colors } = theme;

export const WORK_TYPES = [
	{ value: 'maintenance', label: '🔩 Maintenance' },
	{ value: 'repair', label: '🔧 Repair' },
	{ value: 'enhancement', label: '⬆️ Enhancement' },
];

const TYPE_SUGGESTIONS = {
	maintenance: [
		'Oil Change',
		'Air Filter',
		'Fuel Filter',
		'Hydraulic Filter',
		'Hydraulic Oil',
		'Coolant Change',
		'Grease Joints',
		'Belt Inspection',
		'Belt Replacement',
		'Tire Check',
		'Battery',
		'Annual Service',
		'Pre-Season Inspection',
	],
	repair: [
		'Structural Damage',
		'Engine Repair',
		'Hydraulic Leak',
		'Electrical Fault',
		'Tire Replacement',
		'Belt/Chain Replacement',
		'Bearing Replacement',
		'Welding / Fabrication',
		'Accident Damage',
		'Wear Part Replacement',
	],
	enhancement: [
		'GPS / Guidance Install',
		'Cab Comfort Upgrade',
		'Header Replacement',
		'Row Unit Upgrade',
		'Precision Ag Hardware',
		'Paint / Cosmetic',
		'Engine Rebuild / Overhaul',
		'Implement Modification',
		'Safety Equipment',
		'New Attachment',
		'Winterization',
		'Pre-Season Prep',
	],
};

/** @deprecated Use TYPE_SUGGESTIONS.maintenance directly — this alias predates the unified work-log dialog */
export const MAINTENANCE_TYPES = TYPE_SUGGESTIONS.maintenance;

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class MaintenanceDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.record?.id;
		const record = options.record || {};
		const equipment = options.equipment || {};
		const defaultWorkType = options.workType || record.workType || 'maintenance';

		const unit = equipment.usageUnit || '';
		const usageAtServiceLabel = `Usage at Service${equipment.usage ? ` (current: ${equipment.usage}${unit ? ' ' + unit : ''})` : ''}`;

		super({
			size: 'large',
			header: isEdit ? 'Edit Service Record' : `Log Work — ${equipment.name || 'Equipment'}`,
			data: {
				type: record.type || '',
				date: record.date || new Date().toISOString().slice(0, 10),
				usageAtService: record.usageAtService != null ? record.usageAtService : '',
				cost: record.cost != null ? record.cost : '',
				parts: record.parts || '',
				procedure: record.procedure || '',
			},
			inputs: [
				{ key: 'type', label: 'Description', placeholder: 'What was done / what needs doing' },
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'date', label: 'Date', type: 'date' },
						{
							key: 'usageAtService',
							label: usageAtServiceLabel,
							type: 'number',
							attributes: { step: '0.1' },
							placeholder: unit || 'hrs · mi · uses',
						},
					],
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'cost', label: 'Cost ($)', type: 'number', attributes: { step: '0.01' }, placeholder: 'Optional' },
						{ key: 'parts', label: 'Parts / Supplies', placeholder: 'e.g. Napa 1234' },
					],
				},
				{
					key: 'procedure',
					label: 'Work Done / Notes',
					tag: 'textarea',
					rows: 3,
					placeholder: 'Description, findings, any follow-up needed…',
				},
			],
			onSave: async d => {
				return keepOpenIfFailed(
					await options.onSave?.({
						equipmentId: equipment.id,
						workType: this._workType,
						type: d.type,
						date: d.date,
						usageAtService: toNum(d.usageAtService),
						cost: toNum(d.cost),
						parts: d.parts,
						procedure: d.procedure,
						properties: collectProps(),
					}),
				);
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete this ${record.type || 'service'} record?` },
			}),
			...withoutCallbacks(options),
		});

		this._workType = defaultWorkType;

		// Work type selector
		const typeRow = new Component({
			appendTo: this.intro,
			style: { display: 'flex', gap: '6px', marginBottom: '4px' },
		});
		const typeButtons = [];

		const refreshTypeBtn = () => {
			for (const [wt, btn] of typeButtons) btn.toggleClass('active', this._workType === wt);
		};

		// The type field's suggestions follow the kind of work
		const refreshSuggestions = () => {
			this.form.inputElements.type.options.suggestions = TYPE_SUGGESTIONS[this._workType] || [];
		};

		for (const { value, label } of WORK_TYPES) {
			const btn = new Button({
				textContent: label,
				variant: 'chip',
				style: { flex: '1' },
				appendTo: typeRow,
				onPointerPress: () => {
					this._workType = value;
					refreshTypeBtn();
					refreshSuggestions();
					this.form.inputElements.type.options.value = '';
					this.form.options.data.type = '';
				},
			});

			btn.elem.type = 'button';
			typeButtons.push([value, btn]);
		}

		refreshTypeBtn();

		if (isEdit) this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'maintenance', record.id));

		refreshSuggestions();

		const { collect: collectProps } = makePropertiesEditor(this.body, record.properties || {});

		// Update hours checkbox
		if (!isEdit && equipment.id) {
			const checkRow = new Component({
				appendTo: this.body,
				style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' },
			});
			const cbId = `maintenance-hrs-${Math.random().toString(36).slice(2)}`;
			const cb = new Elem({ tag: 'input', type: 'checkbox', appendTo: checkRow, attributes: { id: cbId } });

			cb.elem.checked = true;
			cb.elem.style.accentColor = `${colors.info}`;

			const lbl = new Elem({
				tag: 'label',
				appendTo: checkRow,
				textContent: 'Update equipment hours from this record',
				style: { fontSize: '12px', color: colors.gray, cursor: 'pointer' },
			});

			lbl.elem.htmlFor = cbId;

			this._shouldUpdateHours = () =>
				cb.elem.checked && this.form.options.data.usageAtService ? Number(this.form.options.data.usageAtService) : null;
		}
	}
}
