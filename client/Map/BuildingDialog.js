import { FormDialog, Select } from '@vanilla-bean/components';
import { checkboxField, emojiInput, PropertiesField } from '../utils/formFields';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';

const COMMON_TYPES = [
	'Barn',
	'Hay barn',
	'Livestock barn',
	'Machine shed',
	'Equipment shed',
	'Grain bin',
	'Grain storage',
	'Silo',
	'Shop',
	'Welding shop',
	'Garage',
	'Implement shed',
	'House',
	'Farmhouse',
	'Guest house',
	'Greenhouse',
	'Hoop house',
	'High tunnel',
	'Corral',
	'Feed lot',
	'Water pump',
	'Irrigation pump',
	'Well house',
	'Fuel tank',
	'Feedlot',
	'Confinement building',
	'Farrowing barn',
	'Poultry house',
	'Scale house',
	'Office',
	'Other',
];

const EMOJI_MAP = [
	[/barn|stable/i, '🏚️'],
	[/shed|shop|garage|implement/i, '🔧'],
	[/grain|bin|storage|silo/i, '🌾'],
	[/house|home|dwelling|farmhouse/i, '🏠'],
	[/greenhouse|hoop|tunnel/i, '🌿'],
	[/water|pump|well|irrigation/i, '💧'],
	[/corral|pen|lot|confinement|farrowing|poultry/i, '🐄'],
	[/fuel|tank/i, '⛽'],
	[/office|scale/i, '🏢'],
];

export const buildingEmoji = (type, stored) => {
	if (stored) return stored;

	for (const [pattern, emoji] of EMOJI_MAP) {
		if (pattern.test(type || '')) return emoji;
	}

	return '📍';
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class BuildingDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.building?.id;

		const building = options.building || {};

		super({
			header: isEdit ? `Edit — ${options.building.name || 'Building'}` : 'Mark Building',
			data: {
				name: building.name || '',
				type: building.type || '',
				status: building.status || '',
				emojiShown: building.emoji || buildingEmoji(building.type || ''),
				props: building.properties || {},
				labelShown: building.showLabel !== false,
			},
			inputs: [
				emojiInput('emojiShown'),
				{
					key: 'name',
					label: 'Name',
					placeholder: 'e.g. North Barn, Main Shop',
					required: true,
					validate: v => (v ? null : 'Name is required'),
				},
				{
					key: 'type',
					label: 'Type',
					placeholder: 'e.g. Barn, Machine shed, Grain bin',
					suggestions: COMMON_TYPES,
					onChange: ({ value }) => (this.form.inputElements.emojiShown.options.auto = buildingEmoji(value)),
				},
				{
					key: 'status',
					label: 'Status',
					InputComponent: Select,
					options: [
						{ label: 'Active', value: '' },
						{ label: 'Needs maintenance', value: 'needs_maintenance' },
						{ label: 'Needs service', value: 'needs_service' },
						{ label: 'Out of service', value: 'out_of_service' },
						{ label: 'Destroyed', value: 'destroyed' },
					],
				},
				{ key: 'props', label: 'Properties', InputComponent: PropertiesField },
				checkboxField('labelShown', 'Show name label on map'),
			],
			onSave: async d => {
				const { emojiShown, props, labelShown, ...fields } = d;
				const data = {
					...fields,
					emoji: emojiShown !== buildingEmoji(fields.type || '') ? emojiShown : '',
					showLabel: labelShown !== false,
					properties: props ?? {},
				};

				if (options.geometry && !isEdit) data.geometry = options.geometry;
				if (isEdit) data.geometry = options.building.geometry;

				return stayOpenFor(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete "${options.building.name || 'this building'}"?` },
			}),
			...withoutCallbacks(options),
		});

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'buildings', building.id));
		}
	}
}
