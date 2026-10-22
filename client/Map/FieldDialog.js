import { Button, FormDialog, Input, Select } from '@vanilla-bean/components';

import { geodesicAreaSqm, convertArea, AREA_UNITS } from '../geo';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { areaField, Caption, checkboxRow } from './dialogParts';

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class FieldDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.field?.id;
		const geometry = options.geometry || options.field?.geometry;

		const field = options.field || {};

		super({
			size: 'large',
			header: isEdit ? `Edit Field — ${options.field.name}` : 'New Field',
			data: {
				name: field.name || options.prefillName || '',
				tenure: field.tenure || 'own',
			},
			inputs: [
				{
					key: 'name',
					label: 'Field Name',
					placeholder: 'e.g. Home Farm North',
					required: true,
					validate: v => (v ? null : 'Name is required'),
				},
				{
					key: 'tenure',
					label: 'Tenure',
					InputComponent: Select,
					options: [
						{ label: 'Owned', value: 'own' },
						{ label: 'Rented', value: 'rent' },
					],
				},
			],
			onSave: async d => {
				const data = {
					...d,
					acreage: this._acreageInput?.elem.value || '',
					acreageUnit: this._unitSelect?.elem.value || 'ac',
					showLabel: this._showLabelEl?.elem.checked !== false,
					status: this._statusSelect?.elem.value || '',
					trialGroup: this._trialGroupEl?.elem.value.trim() || '',
					trialRole: this._trialRoleSelect?.elem.value || '',
					properties: this._collectProps?.() ?? {},
				};

				if (options.geometry && !isEdit) data.geometry = options.geometry;
				if (isEdit) data.geometry = options.field.geometry;

				return keepOpenIfFailed(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete "${options.field.name || 'this field'}"?` },
			}),
			...withoutCallbacks(options),
		});

		this._addLabelToggle = (parent, defaultOn = true) => {
			this._showLabelEl = checkboxRow(parent, {
				label: 'Show name label on map',
				checked: defaultOn,
				style: { marginBottom: '4px' },
			});
		};

		const defaultUnit = field.acreageUnit || options.acreageUnit || 'ac';
		const sqm = geometry ? geodesicAreaSqm(geometry) : null;
		const calculatedAcreage = sqm ? convertArea(sqm, defaultUnit) : null;
		const estimatedAcreage = options.acreage || field.acreage || calculatedAcreage || '';

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'fields', field.id));
		}

		// Properties (FSA numbers, fencing, notes, etc.)
		const initialProps = field.properties && typeof field.properties === 'object' ? field.properties : {};
		const { collect: collectProps } = makePropertiesEditor(this.body, initialProps);

		this._collectProps = collectProps;

		// Acreage row: value + unit + estimate
		const {
			row: acreageRow,
			input: acreageInput,
			unitSelect,
		} = areaField(this.body, { estimate: estimatedAcreage, unit: defaultUnit });

		this._acreageInput = acreageInput;
		this._unitSelect = unitSelect;

		// Status
		new Caption({ appendTo: this.body, textContent: 'Status' });

		this._statusSelect = new Select({
			appendTo: this.body,
			options: [
				{ value: '', label: 'Active' },
				{ value: 'needs_maintenance', label: 'Needs maintenance' },
				{ value: 'needs_service', label: 'Needs service' },
				{ value: 'out_of_service', label: 'Out of service' },
				{ value: 'fallow', label: 'Fallow' },
				{ value: 'abandoned', label: 'Abandoned' },
				{ value: 'destroyed', label: 'Destroyed' },
			],
			value: field.status || '',
		});

		// Trial / experiment pairing (optional)
		new Caption({ appendTo: this.body, textContent: 'Trial Group' });

		this._trialGroupEl = new Input({
			appendTo: this.body,
			type: 'text',
			placeholder: 'e.g. FLOURISH 2024',
			value: field.trialGroup || '',
		});

		new Caption({ appendTo: this.body, textContent: 'Trial Role' });

		this._trialRoleSelect = new Select({
			appendTo: this.body,
			options: [
				{ value: '', label: 'None' },
				{ value: 'treatment', label: 'Treatment' },
				{ value: 'control', label: 'Control' },
			],
			value: field.trialRole || '',
		});

		// Show label toggle — default on
		this._addLabelToggle(this.body, field.showLabel !== false);

		if (geometry) {
			new Button({
				appendTo: acreageRow,
				variant: 'flat',
				icon: 'rotate-left',
				title: 'Calculate from boundary',
				onPointerPress: () => {
					if (!sqm) return;

					const unit = this._unitSelect.elem.value;
					const val = convertArea(sqm, unit);
					const meta = AREA_UNITS.find(u => u.value === unit);

					this._acreageInput.elem.value = val.toFixed(meta?.decimals ?? 1);
				},
			});
		}
	}
}
