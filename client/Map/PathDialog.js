import { Elem, FormDialog, Button } from '@vanilla-bean/components';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { makePropertiesEditor } from '../utils/PropertiesEditor';

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

export const pathColor = path => path.color || '#8B6914';

export const feetToWeight = (widthFt, zoom = 17) => {
	const ft = Number(widthFt) || 6;
	// At zoom 17, ~3 ft per pixel (40° lat) → 1 ft ≈ 0.33 px
	const scale = Math.pow(2, zoom - 17);

	return Math.max(1.5, Math.min(40, ft * (1 / 3) * scale));
};

const BASE_INPUT = {
	display: 'block',
	width: '100%',
	background: 'rgba(255,255,255,0.07)',
	border: '1px solid rgba(255,255,255,0.12)',
	borderRadius: '4px',
	color: '#fff',
	fontSize: '16px',
	padding: '8px 10px',
	boxSizing: 'border-box',
	fontFamily: 'inherit',
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

		this._selectedColor = path.color || '#8B6914';

		// Emoji row
		const emojiRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' },
		});

		const emojiInput = new Elem({
			tag: 'input',
			appendTo: emojiRow,
			style: {
				...BASE_INPUT,
				width: '52px',
				textAlign: 'center',
				fontSize: '22px',
				padding: '4px',
				flexShrink: '0',
				display: 'block',
			},
			attributes: { type: 'text', maxlength: '4', title: 'Tap to change emoji — auto-detected from type' },
		});

		emojiInput.elem.value = path.emoji || detectPathEmoji(path.type || '');

		const emojiHint = new Elem({
			tag: 'span',
			appendTo: emojiRow,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)' },
			textContent: 'Auto-detected · tap to change',
		});

		emojiInput.elem.addEventListener('input', () => {
			emojiInput.elem.dataset.manual = emojiInput.elem.value ? '1' : '';
			emojiHint.elem.textContent = emojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		this._getEmoji = () => {
			const auto = detectPathEmoji(this._typeEl?.elem.value || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		// Name
		const lbl = s =>
			new Elem({
				tag: 'label',
				appendTo: this.body,
				textContent: s,
				style: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '10px 0 4px' },
			});

		lbl('Name');
		this._nameEl = new Elem({
			tag: 'input',
			appendTo: this.body,
			style: BASE_INPUT,
			attributes: { type: 'text', placeholder: 'e.g. North Lane, Driveway' },
		});
		this._nameEl.elem.value = path.name || '';

		lbl('Type');
		this._typeEl = new Elem({
			tag: 'input',
			appendTo: this.body,
			style: BASE_INPUT,
			attributes: { type: 'text', placeholder: 'e.g. Driveway, Farm road, Trail, Creek road' },
		});
		this._typeEl.elem.value = path.type || '';
		this._typeEl.elem.addEventListener('input', () => {
			if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = detectPathEmoji(this._typeEl.elem.value);
		});

		lbl('Width (feet)');
		this._widthEl = new Elem({
			tag: 'input',
			appendTo: this.body,
			style: BASE_INPUT,
			attributes: { type: 'number', step: '1', min: '1', placeholder: '10' },
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
				attributes: { type: 'button' },
				style: {
					background: value === this._selectedColor ? `${value}44` : 'transparent',
					border: `2px solid ${value}`,
					borderRadius: '6px',
					color: '#fff',
					cursor: 'pointer',
					fontSize: '11px',
					padding: '5px 4px',
				},
				onPointerPress: ({ elem }) => {
					this._selectedColor = value;
					Array.from(colorRow.elem.children).forEach(b => {
						b.style.background = 'transparent';
					});
					elem.style.background = `${value}44`;
				},
			});
		}

		const { collect: collectProps } = makePropertiesEditor(this.body, path.properties || {});
		this._collectProps = collectProps;

		// Status
		lbl('Status');
		this._statusSelect = new Elem({
			tag: 'select',
			appendTo: this.body,
			style: { ...BASE_INPUT, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' },
		});
		[
			{ value: '', label: '✓ Active' },
			{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
			{ value: 'needs_service', label: '🔧 Needs service' },
			{ value: 'out_of_service', label: '⚠️ Out of service' },
			{ value: 'closed', label: '🚫 Closed' },
			{ value: 'destroyed', label: '☠️ Destroyed' },
		].forEach(({ value, label }) => {
			const o = document.createElement('option');
			o.value = value;
			o.textContent = label;
			this._statusSelect.elem.append(o);
		});
		this._statusSelect.elem.value = path.status || '';

		// Show label toggle — off by default for paths
		const labelRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' },
		});

		this._showLabelEl = new Elem({
			tag: 'input',
			appendTo: labelRow,
			attributes: { type: 'checkbox' },
			style: { accentColor: '#4a90d9' },
		});
		this._showLabelEl.elem.checked = path.showLabel === true;

		new Elem({
			tag: 'label',
			appendTo: labelRow,
			textContent: 'Show name label on map',
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' },
		}).elem.addEventListener('click', () => {
			this._showLabelEl.elem.checked = !this._showLabelEl.elem.checked;
		});

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
