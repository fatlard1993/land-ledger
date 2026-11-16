import { FormDialog, Select } from '@vanilla-bean/components';
import { stayOpenFor } from '../utils/stayOpenFor';
import { checkboxField, emojiInput, numberField, PropertiesField } from '../utils/formFields';

// Stored on each path as its color, so these stay the literal values saved records hold
export const PATH_COLORS = [
	{ value: '#8B6914', label: '🟤 Dirt' },
	{ value: '#9E9E9E', label: '⬜ Gravel' },
	{ value: '#424242', label: '⬛ Paved' },
	{ value: '#795548', label: '🟫 Farm road' },
	{ value: '#4CAF50', label: '🟩 Grass' },
	{ value: '#607D8B', label: '🩶 Lane' },
	{ value: '#F44336', label: '🔴 Emergency' },
];

const PATH_EMOJI_MAP = [
	[/trail|hike|footpath/i, '🥾'],
	[/walk|path|footway/i, '👣'],
	[/driveway|drive/i, '🚗'],
	[/farm.road|dirt.road|country/i, '🚜'],
	[/road|highway|street/i, '🛣️'],
	[/creek|water|ford/i, '💧'],
	[/grass|green.path/i, '🌿'],
	[/lane/i, '🛤️'],
];

export const detectPathEmoji = (type, stored) => {
	if (stored) return stored;

	for (const [pattern, emoji] of PATH_EMOJI_MAP) {
		if (pattern.test(type || '')) return emoji;
	}

	return '🛤️';
};

export const pathColor = path => path.color || PATH_COLORS[0].value;

export const feetToWeight = (widthFt, zoom = 17) => {
	const ft = Number(widthFt) || 6;
	// At zoom 17, ~3 ft per pixel (40° lat) → 1 ft ≈ 0.33 px
	const scale = Math.pow(2, zoom - 17);

	return Math.max(1.5, Math.min(40, ft * (1 / 3) * scale));
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

const PATH_STATUSES = [
	{ value: '', label: 'Active' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'needs_service', label: 'Needs service' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'closed', label: 'Closed' },
	{ value: 'destroyed', label: 'Destroyed' },
];

export default class PathDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.path?.id;
		const path = options.path || {};

		super({
			header: isEdit ? `Edit Path — ${path.name || ''}` : 'Mark Path / Road',
			data: {
				emoji: path.emoji || detectPathEmoji(path.type || ''),
				name: path.name || '',
				type: path.type || '',
				widthFt: path.widthFt || '10',
				color: pathColor(path),
				properties: path.properties || {},
				status: path.status || '',
				showLabel: path.showLabel === true,
			},
			inputs: [
				emojiInput(),
				{ key: 'name', label: 'Name', placeholder: 'e.g. North Lane, Driveway' },
				{
					key: 'type',
					label: 'Type',
					placeholder: 'e.g. Driveway, Farm road, Trail, Creek road',
					onInput: ({ value }) => (this.form.inputElements.emoji.options.auto = detectPathEmoji(value)),
				},
				{ key: 'widthFt', label: 'Width (feet)', placeholder: '10', ...numberField({ step: '1', min: '1' }) },
				// The surface is stored as its color, which draws the path on the map
				{ key: 'color', label: 'Surface / color', InputComponent: Select, options: PATH_COLORS },
				{ key: 'properties', InputComponent: PropertiesField },
				{ key: 'status', label: 'Status', InputComponent: Select, options: PATH_STATUSES },
				// Off by default for paths
				checkboxField('showLabel', 'Show name label on map'),
			],
			onSave: async data => stayOpenFor(await options.onSave?.(this._collect(data))),
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => stayOpenFor(await options.onDelete()),
					confirmDelete: { header: `Delete "${path.name || 'this path'}"?` },
				}),
			...withoutCallbacks(options),
		});

		this._collect = ({ emoji, name, type, widthFt, color, status, showLabel, properties }) => {
			const data = {
				name,
				type,
				widthFt: widthFt || '10',
				color,
				emoji: emoji !== detectPathEmoji(type || '') ? emoji : '',
				status: status || '',
				showLabel,
				properties: properties ?? {},
			};

			if (options.geometry && !isEdit) data.geometry = options.geometry;
			if (isEdit) data.geometry = path.geometry;

			return data;
		};
	}
}
