import { FormDialog, Select } from '@vanilla-bean/components';

import { geodesicAreaSqm, convertArea } from '../geo';
import { checkboxField, PropertiesField } from '../utils/formFields';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';
import { AreaField } from './dialogParts';

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

const FIELD_STATUSES = [
	{ value: '', label: 'Active' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'needs_service', label: 'Needs service' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'fallow', label: 'Fallow' },
	{ value: 'abandoned', label: 'Abandoned' },
	{ value: 'destroyed', label: 'Destroyed' },
];

const TRIAL_ROLES = [
	{ value: '', label: 'None' },
	{ value: 'treatment', label: 'Treatment' },
	{ value: 'control', label: 'Control' },
];

// Fields that aren't the record's own keys as it holds them are named apart, so a change made on another device is
// compared only with the fields that hold it as it's saved
export default class FieldDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.field?.id;
		const geometry = options.geometry || options.field?.geometry;

		const field = options.field || {};
		const defaultUnit = field.acreageUnit || options.acreageUnit || 'ac';
		const sqm = geometry ? geodesicAreaSqm(geometry) : null;
		const calculatedAcreage = sqm ? convertArea(sqm, defaultUnit) : null;
		const estimatedAcreage = options.acreage || field.acreage || calculatedAcreage || '';

		super({
			header: isEdit ? `Edit Field — ${options.field.name}` : 'New Field',
			data: {
				name: field.name || options.prefillName || '',
				tenure: field.tenure || 'own',
				// FSA numbers, fencing, notes, etc.
				props: field.properties && typeof field.properties === 'object' ? field.properties : {},
				area: { size: estimatedAcreage || '', unit: defaultUnit },
				status: field.status || '',
				trialGroup: field.trialGroup || '',
				trialRole: field.trialRole || '',
				// Default on
				labelShown: field.showLabel !== false,
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
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },
				{ key: 'area', label: 'Area', InputComponent: AreaField, sqm, measurable: !!geometry },
				{ key: 'status', label: 'Status', InputComponent: Select, options: FIELD_STATUSES },
				// Trial / experiment pairing (optional)
				{ key: 'trialGroup', label: 'Trial Group', placeholder: 'e.g. FLOURISH 2024' },
				{ key: 'trialRole', label: 'Trial Role', InputComponent: Select, options: TRIAL_ROLES },
				checkboxField('labelShown', 'Show name label on map'),
			],
			onSave: async d => {
				const data = {
					name: d.name,
					tenure: d.tenure,
					acreage: d.area.size ?? '',
					acreageUnit: d.area.unit || 'ac',
					showLabel: d.labelShown !== false,
					status: d.status || '',
					trialGroup: d.trialGroup.trim() || '',
					trialRole: d.trialRole || '',
					properties: d.props ?? {},
				};

				if (options.geometry && !isEdit) data.geometry = options.geometry;
				if (isEdit) data.geometry = options.field.geometry;

				return stayOpenFor(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete "${options.field.name || 'this field'}"?` },
			}),
			...withoutCallbacks(options),
		});

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'fields', field.id));
		}
	}
}
