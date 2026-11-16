import { FormDialog, Select } from '@vanilla-bean/components';
import { checkboxField, PropertiesField } from '../utils/formFields';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';

import { geodesicAreaSqm, convertArea } from '../geo';
import { stayOpenFor } from '../utils/stayOpenFor';
import { AreaField } from './dialogParts';

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

const PARCEL_STATUSES = [
	{ value: '', label: 'Active' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'disputed', label: 'Disputed' },
	{ value: 'encumbered', label: 'Encumbered' },
	{ value: 'destroyed', label: 'Destroyed' },
];

// Fields that aren't the record's own keys as it holds them are named apart, so a change made on another device is
// compared only with the fields that hold it as it's saved
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
			header: isEdit ? `Edit Property Line — ${options.parcel.name || ''}` : 'Mark Property Line',
			data: {
				name: parcel.name || '',
				parcelId: parcel.parcelId || '',
				owner: parcel.owner || '',
				props: parcel.properties || {},
				area: { size: estimatedAcreage || '', unit: defaultUnit },
				status: parcel.status || '',
				labelShown: parcel.showLabel !== false,
			},
			inputs: [
				{ key: 'name', label: 'Description', placeholder: 'e.g. North Parcel, Home Quarter' },
				{ key: 'parcelId', label: 'Parcel / APN #', placeholder: 'Tax parcel ID from county assessor' },
				{ key: 'owner', label: 'Owner', placeholder: 'Optional — for tracking leased parcels' },
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },
				{ key: 'area', label: 'Area', InputComponent: AreaField, sqm, measurable: !!sqm },
				{ key: 'status', label: 'Status', InputComponent: Select, options: PARCEL_STATUSES },
				checkboxField('labelShown', 'Show name label on map'),
			],
			onSave: async d => {
				const data = {
					name: d.name,
					parcelId: d.parcelId,
					owner: d.owner,
					acreage: d.area.size ?? '',
					acreageUnit: d.area.unit || 'ac',
					status: d.status || '',
					showLabel: d.labelShown !== false,
					properties: d.props ?? {},
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

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'parcels', parcel.id));
		}
	}
}
