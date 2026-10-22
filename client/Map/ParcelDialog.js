import { Button, FormDialog, Select, theme } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

import { geodesicAreaSqm, convertArea, AREA_UNITS } from '../geo';
import { stayOpenFor } from '../utils/stayOpenFor';
import { areaField, Caption, checkboxRow } from './dialogParts';

const { space } = theme;

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

				return stayOpenFor(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete this property line?` },
			}),
			...withoutCallbacks(options),
		});

		const addLabelToggle = (parent, defaultOn = true) => {
			this._showLabelEl = checkboxRow(parent, {
				label: 'Show name label on map',
				checked: defaultOn,
				style: { marginBottom: space.xs },
			});
		};

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'parcels', parcel.id));
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, parcel.properties || {});
		this._collectProps = collectProps;

		// Area row
		const {
			row: areaRow,
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
				{ value: 'out_of_service', label: 'Out of service' },
				{ value: 'disputed', label: 'Disputed' },
				{ value: 'encumbered', label: 'Encumbered' },
				{ value: 'destroyed', label: 'Destroyed' },
			],
			value: parcel.status || '',
		});

		addLabelToggle(this.body, parcel.showLabel !== false);

		if (sqm) {
			new Button({
				appendTo: areaRow,
				variant: 'flat',
				icon: 'rotate-left',
				title: 'Calculate from boundary',
				attributes: { type: 'button' },
				onPointerPress: () => {
					const unit = this._unitSelect.elem.value;
					const meta = AREA_UNITS.find(u => u.value === unit);

					this._acreageInput.elem.value = convertArea(sqm, unit).toFixed(meta?.decimals ?? 1);
				},
			});
		}
	}
}
