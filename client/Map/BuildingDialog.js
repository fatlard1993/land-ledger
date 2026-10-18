import { FormDialog, Elem, Select } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';

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
			size: 'large',
			header: isEdit ? `Edit — ${options.building.name || 'Building'}` : 'Mark Building',
			data: {
				name: building.name || '',
				type: building.type || '',
				status: building.status || '',
			},
			inputs: [
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
					onChange: ({ value }) => {
						if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = buildingEmoji(value);
					},
				},
				{
					key: 'status',
					label: 'Status',
					InputComponent: Select,
					options: [
						{ label: '✓ Active', value: '' },
						{ label: '🔩 Needs maintenance', value: 'needs_maintenance' },
						{ label: '🔧 Needs service', value: 'needs_service' },
						{ label: '⚠️ Out of service', value: 'out_of_service' },
						{ label: '☠️ Destroyed', value: 'destroyed' },
					],
				},
			],
			onSave: async d => {
				const data = {
					...d,
					emoji: this._getEmoji?.() || '',
					showLabel: this._showLabelEl?.elem.checked !== false,
					properties: this._collectProps?.() ?? {},
				};

				if (options.geometry && !isEdit) data.geometry = options.geometry;
				if (isEdit) data.geometry = options.building.geometry;

				return keepOpenIfFailed(await options.onSave?.(data));
			},
			...(isEdit && {
				onDelete: async () => keepOpenIfFailed(await options.onDelete?.(), 'Delete'),
				confirmDelete: { header: `Delete "${options.building.name || 'this building'}"?` },
			}),
			...withoutCallbacks(options),
		});

		// Emoji row
		const emojiRow = new Elem({
			tag: 'div',
			appendTo: this.intro,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' },
		});

		const emojiInput = new Elem({
			tag: 'input',
			appendTo: emojiRow,
			attributes: { title: 'Tap to change emoji — auto-detected from type' },
			style: {
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '22px',
				padding: '4px',
				width: '52px',
				textAlign: 'center',
				flexShrink: '0',
				fontFamily: 'inherit',
				boxSizing: 'border-box',
			},
		});

		emojiInput.elem.type = 'text';
		emojiInput.elem.maxLength = 4;
		emojiInput.elem.value = building.emoji || buildingEmoji(building.type || '');

		const emojiHint = new Elem({
			tag: 'span',
			appendTo: emojiRow,
			textContent: 'Auto-detected · tap to change',
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)' },
		});

		emojiInput.elem.addEventListener('input', () => {
			emojiInput.elem.dataset.manual = emojiInput.elem.value ? '1' : '';
			emojiHint.elem.textContent = emojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		const { collect: collectProps } = makePropertiesEditor(this.body, building.properties || {});
		this._collectProps = collectProps;

		this._getEmoji = () => {
			const auto = buildingEmoji(this.form.options.data.type || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		if (isEdit) {
			this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'buildings', building.id));
		}

		// Show label toggle
		const _cbUniqueId = `lbl-${Math.random().toString(36).slice(2)}`;

		const labelRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' },
		});

		this._showLabelEl = new Elem({
			tag: 'input',
			appendTo: labelRow,
			attributes: { id: _cbUniqueId },
		});

		this._showLabelEl.elem.type = 'checkbox';
		this._showLabelEl.elem.checked = options.building?.showLabel !== false;
		this._showLabelEl.elem.style.accentColor = '#4a90d9';

		new Elem({
			tag: 'label',
			appendTo: labelRow,
			textContent: 'Show name label on map',
			attributes: { for: _cbUniqueId },
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' },
		});
	}
}
