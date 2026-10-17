import { Dialog, Form, Elem, Select, Button, conditionalList } from '@vanilla-bean/components';

import { geodesicAreaSqm, convertArea, AREA_UNITS } from '../geo';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

const ACREAGE_INPUT_STYLE = {
	flex: '1',
	background: 'transparent',
	border: 'none',
	outline: 'none',
	color: '#fff',
	fontSize: '16px',
	padding: '8px 10px',
	minWidth: '0',
	fontFamily: 'inherit',
};

export default class FieldDialog extends Dialog {
	constructor(options = {}) {
		const isEdit = !!options.field?.id;
		const geometry = options.geometry || options.field?.geometry;

		super({
			size: 'large',
			header: isEdit ? `Edit Field — ${options.field.name}` : 'New Field',
			buttons: conditionalList([{ alwaysItem: 'Save' }, { if: isEdit, thenItem: 'Delete' }, { alwaysItem: 'Cancel' }]),
			onButtonPress: ({ button }) => {
				if (button === 'Save') {
					if (this.form.hasErrors()) return;

					const data = {
						...this.form.options.data,
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

					options.onSave?.(data);
				} else if (button === 'Delete') {
					options.onDelete?.();
				}

				this.close();
			},
			...options,
		});

		const field = options.field || {};

		this._addLabelToggle = (parent, defaultOn = true) => {
			const row = new Elem({
				tag: 'div',
				appendTo: parent,
				style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '4px' },
			});

			const _checkboxId = `label-${Math.random().toString(36).slice(2)}`;

			this._showLabelEl = new Elem({
				tag: 'input',
				appendTo: row,
				attributes: { type: 'checkbox', id: _checkboxId },
			});
			this._showLabelEl.elem.checked = defaultOn;
			this._showLabelEl.elem.style.accentColor = '#4a90d9';

			new Elem({
				tag: 'label',
				appendTo: row,
				textContent: 'Show name label on map',
				attributes: { for: _checkboxId },
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' },
			});
		};

		const defaultUnit = field.acreageUnit || options.acreageUnit || 'ac';
		const sqm = geometry ? geodesicAreaSqm(geometry) : null;
		const calculatedAcreage = sqm ? convertArea(sqm, defaultUnit) : null;
		const estimatedAcreage = options.acreage || field.acreage || calculatedAcreage || '';

		this.form = new Form({
			appendTo: this.body,
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
		});

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'fields', field.id));
		}

		// Properties (FSA numbers, fencing, notes, etc.)
		const initialProps = field.properties && typeof field.properties === 'object' ? field.properties : {};
		const { collect: collectProps } = makePropertiesEditor(this.body, initialProps);

		this._collectProps = collectProps;

		// Acreage row: value + unit + estimate
		new Elem({
			tag: 'label',
			appendTo: this.body,
			style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
			textContent: 'Area',
		});

		const acreageRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: {
				display: 'flex',
				alignItems: 'center',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				overflow: 'hidden',
			},
		});

		this._acreageInput = new Elem({
			tag: 'input',
			appendTo: acreageRow,
			attributes: {
				type: 'number',
				step: '0.01',
				min: '0',
				placeholder: estimatedAcreage ? `~${estimatedAcreage}` : 'Size',
			},
			style: ACREAGE_INPUT_STYLE,
		});
		this._acreageInput.elem.value = estimatedAcreage || '';

		// Unit selector
		this._unitSelect = new Elem({
			tag: 'select',
			appendTo: acreageRow,
			style: {
				background: 'transparent',
				border: 'none',
				borderLeft: '1px solid rgba(255,255,255,0.12)',
				color: '#fff',
				cursor: 'pointer',
				fontSize: '13px',
				padding: '8px 4px',
				fontFamily: 'inherit',
				flexShrink: '0',
				outline: 'none',
				width: '54px',
			},
		});

		for (const { value, label } of AREA_UNITS) {
			const opt = document.createElement('option');

			opt.value = value;
			opt.textContent = label;
			opt.style.background = '#1a1a1a';
			this._unitSelect.elem.append(opt);
		}

		this._unitSelect.elem.value = defaultUnit;

		// Status
		new Elem({
			tag: 'label',
			appendTo: this.body,
			textContent: 'Status',
			style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
		});

		this._statusSelect = new Elem({
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
				fontSize: '16px',
				padding: '8px 10px',
				fontFamily: 'inherit',
				cursor: 'pointer',
				appearance: 'auto',
				webkitAppearance: 'auto',
			},
		});

		[
			{ value: '', label: '✓ Active' },
			{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
			{ value: 'needs_service', label: '🔧 Needs service' },
			{ value: 'out_of_service', label: '⚠️ Out of service' },
			{ value: 'fallow', label: '😴 Fallow' },
			{ value: 'abandoned', label: '🏚️ Abandoned' },
			{ value: 'destroyed', label: '☠️ Destroyed' },
		].forEach(({ value, label }) => {
			const o = document.createElement('option');
			o.value = value;
			o.textContent = label;
			this._statusSelect.elem.append(o);
		});
		this._statusSelect.elem.value = field.status || '';

		// Trial / experiment pairing (optional)
		new Elem({
			tag: 'label',
			appendTo: this.body,
			textContent: 'Trial Group',
			style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
		});

		this._trialGroupEl = new Elem({
			tag: 'input',
			appendTo: this.body,
			attributes: { type: 'text', placeholder: 'e.g. FLOURISH 2024' },
			style: {
				display: 'block',
				width: '100%',
				boxSizing: 'border-box',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '16px',
				padding: '8px 10px',
				fontFamily: 'inherit',
			},
		});
		this._trialGroupEl.elem.value = field.trialGroup || '';

		new Elem({
			tag: 'label',
			appendTo: this.body,
			textContent: 'Trial Role',
			style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
		});

		this._trialRoleSelect = new Elem({
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
				fontSize: '16px',
				padding: '8px 10px',
				fontFamily: 'inherit',
				cursor: 'pointer',
				appearance: 'auto',
				webkitAppearance: 'auto',
			},
		});

		[
			{ value: '', label: 'None' },
			{ value: 'treatment', label: 'Treatment' },
			{ value: 'control', label: 'Control' },
		].forEach(({ value, label: l }) => {
			const o = document.createElement('option');
			o.value = value;
			o.textContent = l;
			this._trialRoleSelect.elem.append(o);
		});
		this._trialRoleSelect.elem.value = field.trialRole || '';

		// Show label toggle — default on
		this._addLabelToggle(this.body, field.showLabel !== false);

		if (geometry) {
			new Button({
				appendTo: acreageRow,
				textContent: '↺',
				title: 'Calculate from boundary',
				style: {
					borderRadius: '0',
					borderLeft: '1px solid rgba(255,255,255,0.12)',
					padding: '8px 10px',
					fontSize: '13px',
					flexShrink: '0',
				},
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
