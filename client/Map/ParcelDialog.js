import { FormDialog, Elem, Button } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

import { geodesicAreaSqm, convertArea, AREA_UNITS } from '../geo';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';

const ACREAGE_STYLE = {
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

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class ParcelDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.parcel?.id;
		const geometry = options.geometry || options.parcel?.geometry;
		const sqm = geometry ? geodesicAreaSqm(geometry) : null;
		const defaultUnit = options.parcel?.acreageUnit || 'ac';
		const calcAcreage = sqm ? convertArea(sqm, defaultUnit) : null;
		const estimatedAcreage = options.acreage || options.parcel?.acreage || calcAcreage || '';

		const parcel = options.parcel || {};

		super({
			size: 'large',
			header: isEdit ? `Edit Property Line — ${options.parcel.name || ''}` : 'Mark Property Line',
			data: {
				name: parcel.name || '',
				parcelId: parcel.parcelId || '',
				owner: parcel.owner || '',
			},
			inputs: [
				{ key: 'name', label: 'Description', placeholder: 'e.g. North Parcel, Home Quarter' },
				{ key: 'parcelId', label: 'Parcel / APN #', placeholder: 'Tax parcel ID from county assessor' },
				{ key: 'owner', label: 'Owner', placeholder: 'Optional — for tracking leased parcels' },
			],
			onSave: async d => {
				const data = {
					...d,
					acreage: this._acreageInput?.elem.value || '',
					acreageUnit: this._unitSelect?.elem.value || 'ac',
					status: this._statusSelect?.elem.value || '',
					showLabel: this._showLabelEl?.elem.checked !== false,
					properties: this._collectProps?.() ?? {},
				};

				if (geometry && !isEdit) data.geometry = geometry;
				if (isEdit) data.geometry = options.parcel.geometry;

				return keepOpenIfFailed(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete this property line?` },
			}),
			...withoutCallbacks(options),
		});

		const addLabelToggle = (parent, defaultOn = true) => {
			const _checkboxId = `label-${Math.random().toString(36).slice(2)}`;

			const row = new Elem({
				tag: 'div',
				appendTo: parent,
				style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '4px' },
			});

			this._showLabelEl = new Elem({
				tag: 'input',
				appendTo: row,
				attributes: { type: 'checkbox', id: _checkboxId },
				style: { accentColor: '#4a90d9' },
			});
			this._showLabelEl.elem.checked = defaultOn;

			new Elem({
				tag: 'label',
				appendTo: row,
				attributes: { for: _checkboxId },
				textContent: 'Show name label on map',
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' },
			});
		};

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'parcels', parcel.id));
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, parcel.properties || {});
		this._collectProps = collectProps;

		// Area row
		new Elem({
			tag: 'label',
			appendTo: this.body,
			style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
			textContent: 'Area',
		});

		const areaRow = new Elem({
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
			appendTo: areaRow,
			attributes: {
				type: 'number',
				step: '0.01',
				min: '0',
				placeholder: estimatedAcreage ? `~${estimatedAcreage}` : 'Size',
			},
			style: ACREAGE_STYLE,
		});
		this._acreageInput.elem.value = estimatedAcreage || '';

		this._unitSelect = new Elem({
			tag: 'select',
			appendTo: areaRow,
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
			{ value: 'out_of_service', label: '⚠️ Out of service' },
			{ value: 'disputed', label: '⚖️ Disputed' },
			{ value: 'encumbered', label: '🔒 Encumbered' },
			{ value: 'destroyed', label: '☠️ Destroyed' },
		].forEach(({ value, label }) => {
			const o = document.createElement('option');
			o.value = value;
			o.textContent = label;
			this._statusSelect.elem.append(o);
		});
		this._statusSelect.elem.value = parcel.status || '';

		addLabelToggle(this.body, parcel.showLabel !== false);

		if (sqm) {
			new Button({
				appendTo: areaRow,
				textContent: '↺',
				attributes: { type: 'button' },
				style: {
					border: 'none',
					borderLeft: '1px solid rgba(255,255,255,0.12)',
					background: 'transparent',
					color: '#fff',
					cursor: 'pointer',
					padding: '8px 10px',
					fontSize: '13px',
					flexShrink: '0',
				},
				onPointerPress: () => {
					const unit = this._unitSelect.elem.value;
					const meta = AREA_UNITS.find(u => u.value === unit);

					this._acreageInput.elem.value = convertArea(sqm, unit).toFixed(meta?.decimals ?? 1);
				},
			});
		}
	}
}
