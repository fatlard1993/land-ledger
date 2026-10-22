import { Button, Elem, FormDialog, Input, Select } from '@vanilla-bean/components';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { Caption, checkboxRow, emojiField } from './dialogParts';

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

export default class PathDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.path?.id;

		// The body is built by hand below, so the form holds no inputs and saving collects from the body
		super({
			size: 'large',
			header: isEdit ? `Edit Path — ${options.path.name || ''}` : 'Mark Path / Road',
			inputs: [],
			onSave: async () => keepOpenIfFailed(await options.onSave?.(this._collect())),
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => keepOpenIfFailed(await options.onDelete(), 'Delete'),
					confirmDelete: { header: `Delete "${options.path.name || 'this path'}"?` },
				}),
			...withoutCallbacks(options),
		});

		const path = options.path || {};

		this._selectedColor = pathColor(path);

		// Emoji row
		const emojiInput = emojiField(this.body, path.emoji || detectPathEmoji(path.type || ''));

		this._getEmoji = () => {
			const auto = detectPathEmoji(this._typeEl?.elem.value || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		// Name
		const lbl = s => new Caption({ appendTo: this.body, textContent: s });

		lbl('Name');
		this._nameEl = new Input({ appendTo: this.body, type: 'text', placeholder: 'e.g. North Lane, Driveway' });
		this._nameEl.elem.value = path.name || '';

		lbl('Type');
		this._typeEl = new Input({
			appendTo: this.body,
			type: 'text',
			placeholder: 'e.g. Driveway, Farm road, Trail, Creek road',
		});
		this._typeEl.elem.value = path.type || '';
		this._typeEl.elem.addEventListener('input', () => {
			if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = detectPathEmoji(this._typeEl.elem.value);
		});

		lbl('Width (feet)');
		this._widthEl = new Input({
			appendTo: this.body,
			type: 'number',
			placeholder: '10',
			attributes: { step: '1', min: '1' },
		});
		this._widthEl.elem.value = path.widthFt || '10';

		// Color
		lbl('Surface / color');

		const colorRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' },
		});

		for (const { value, label } of PATH_COLORS) {
			new Button({
				textContent: label,
				appendTo: colorRow,
				variant: 'chip',
				...(value === this._selectedColor && { addClass: 'active' }),
				attributes: { type: 'button' },
				style: { borderColor: value, fontSize: '11px' },
				onPointerPress: ({ elem }) => {
					this._selectedColor = value;
					Array.from(colorRow.elem.children).forEach(b => b.classList.remove('active'));
					elem.classList.add('active');
				},
			});
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, path.properties || {});
		this._collectProps = collectProps;

		// Status
		lbl('Status');
		this._statusSelect = new Select({
			appendTo: this.body,
			options: [
				{ value: '', label: 'Active' },
				{ value: 'needs_maintenance', label: 'Needs maintenance' },
				{ value: 'needs_service', label: 'Needs service' },
				{ value: 'out_of_service', label: 'Out of service' },
				{ value: 'closed', label: 'Closed' },
				{ value: 'destroyed', label: 'Destroyed' },
			],
			value: path.status || '',
		});

		// Show label toggle — off by default for paths
		this._showLabelEl = checkboxRow(this.body, { label: 'Show name label on map', checked: path.showLabel === true });

		this._collect = () => {
			const data = {
				name: this._nameEl.elem.value,
				type: this._typeEl.elem.value,
				widthFt: this._widthEl.elem.value || '10',
				color: this._selectedColor,
				emoji: this._getEmoji?.() || '',
				status: this._statusSelect?.elem.value || '',
				showLabel: this._showLabelEl.elem.checked,
				properties: this._collectProps?.() ?? {},
			};

			if (options.geometry && !isEdit) data.geometry = options.geometry;
			if (isEdit) data.geometry = options.path.geometry;

			return data;
		};
	}
}
