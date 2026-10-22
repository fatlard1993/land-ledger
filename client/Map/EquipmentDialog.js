import { FormDialog, Select } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { stayOpenFor } from '../utils/stayOpenFor';
import { checkboxRow, emojiField } from './dialogParts';

const COMMON_TYPES = [
	'Tractor',
	'Row crop tractor',
	'4WD tractor',
	'Planter',
	'Strip-till planter',
	'Sprayer',
	'Self-propelled sprayer',
	'Combine',
	'Header',
	'Grain cart',
	'Grain wagon',
	'Disc',
	'Ripper',
	'Cultivator',
	'Vertical tillage',
	'Anhydrous applicator',
	'Trailer',
	'Flatbed',
	'Grain trailer',
	'Loader',
	'Skid steer',
	'Telehandler',
	'Baler',
	'Mower',
	'Rake',
	'ATV / UTV',
];

const EMOJI_MAP = [
	[/tractor|row crop|4wd/i, '🚜'],
	[/planter|seeder/i, '🌱'],
	[/sprayer|applicator/i, '💧'],
	[/combine|header/i, '🌾'],
	[/grain.cart|grain.wagon/i, '🛒'],
	[/disc|ripper|cultivator|tillage/i, '🔧'],
	[/trailer|flatbed/i, '🚛'],
	[/baler|mower|rake/i, '🌿'],
	[/loader|skid|telehandler/i, '🏗️'],
	[/atv|utv/i, '🛺'],
];

export const equipmentEmoji = (type, storedEmoji) => {
	if (storedEmoji) return storedEmoji;

	const t = type || '';

	for (const [pattern, emoji] of EMOJI_MAP) {
		if (pattern.test(t)) return emoji;
	}

	return '⚙️';
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class EquipmentDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.item?.id;

		const item = options.item || {};

		super({
			size: 'large',
			header: isEdit ? `Edit — ${options.item.name || 'Equipment'}` : 'Place Equipment',
			data: {
				name: item.name || '',
				type: item.type || '',
				tenure: item.tenure || 'own',
				size: item.size || 'med',
				status: item.status || '',
				usage: item.usage || '',
				usageUnit: item.usageUnit || '',
				appraisalValue: item.appraisalValue || '',
			},
			inputs: [
				{
					key: 'name',
					label: 'Name / ID',
					placeholder: 'e.g. JD 8R 340, Case IH 1220 planter',
					required: true,
					validate: v => (v ? null : 'Name is required'),
				},
				{
					key: 'type',
					label: 'Type',
					placeholder: 'e.g. Row crop tractor, Sprayer, Grain cart',
					suggestions: COMMON_TYPES,
					onChange: ({ value }) => {
						if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = equipmentEmoji(value);
					},
				},
				{
					key: 'tenure',
					label: 'Ownership',
					InputComponent: Select,
					options: [
						{ label: 'Owned', value: 'own' },
						{ label: 'Leased', value: 'lease' },
					],
				},
				{
					key: 'size',
					label: 'Size',
					InputComponent: Select,
					options: [
						{ label: 'Small', value: 'sm' },
						{ label: 'Medium', value: 'med' },
						{ label: 'Large', value: 'lrg' },
						{ label: 'X-Large', value: 'xlrg' },
					],
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
				{
					key: 'usage',
					label: 'Usage',
					type: 'number',
					placeholder: 'Amount',
				},
				{
					key: 'usageUnit',
					label: 'Unit',
					placeholder: 'e.g. hrs, mi, uses',
				},
				{
					key: 'appraisalValue',
					label: 'Appraised Value ($)',
					type: 'number',
					placeholder: 'Market value — used in net worth',
				},
			],
			onSave: async d => {
				const data = {
					...d,
					emoji: this._getEmoji?.() || '',
					showLabel: this._showLabelEl?.elem.checked !== false,
					properties: this._collectProps?.() ?? {},
				};

				if (options.lat != null) data.lat = options.lat;
				if (options.lng != null) data.lng = options.lng;
				if (isEdit) {
					data.lat = options.item.lat;
					data.lng = options.item.lng;
				}

				return stayOpenFor(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete "${options.item.name || 'this equipment'}"?` },
			}),
			...withoutCallbacks(options),
		});

		// Emoji row
		const emojiInput = emojiField(this.intro, item.emoji || equipmentEmoji(item.type || ''));

		this._getEmoji = () => {
			const auto = equipmentEmoji(this.form.options.data.type || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		const { collect: collectProps } = makePropertiesEditor(this.body, item.properties || {});

		this._collectProps = collectProps;

		// Show label toggle
		this._showLabelEl = checkboxRow(this.body, { label: 'Show name label on map', checked: item.showLabel !== false });
	}
}
