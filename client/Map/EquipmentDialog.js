import { Dialog, Form, Elem, Select, conditionalList } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';

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

export default class EquipmentDialog extends Dialog {
	constructor(options = {}) {
		const isEdit = !!options.item?.id;

		super({
			size: 'large',
			header: isEdit ? `Edit — ${options.item.name || 'Equipment'}` : 'Place Equipment',
			buttons: conditionalList([{ alwaysItem: 'Save' }, { if: isEdit, thenItem: 'Delete' }, { alwaysItem: 'Cancel' }]),
			onButtonPress: ({ button }) => {
				if (button === 'Save') {
					if (this.form.validate()) return;

					const data = {
						...this.form.options.data,
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

					options.onSave?.(data);
				} else if (button === 'Delete') {
					options.onDelete?.();
				}

				this.close();
			},
			...options,
		});

		const item = options.item || {};

		// Datalist inside dialog body
		const datalistId = `eq-datalist-${Math.random().toString(36).slice(2)}`;
		const datalist = new Elem({ tag: 'datalist' });

		datalist.elem.id = datalistId;
		COMMON_TYPES.forEach(t => {
			const o = document.createElement('option');
			o.value = t;
			datalist.elem.append(o);
		});
		this.body.elem.prepend(datalist.elem);

		// Emoji row — above form, same pattern as EventDialog
		const emojiRow = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' },
		});

		const emojiInput = new Elem({
			tag: 'input',
			attributes: { type: 'text', maxlength: '4', title: 'Tap to change emoji — auto-detected from type' },
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
			appendTo: emojiRow,
		});

		emojiInput.elem.value = item.emoji || equipmentEmoji(item.type || '');

		const emojiHint = new Elem({
			tag: 'span',
			textContent: 'Auto-detected · tap to change',
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)' },
			appendTo: emojiRow,
		});

		emojiInput.elem.addEventListener('input', () => {
			emojiInput.elem.dataset.manual = emojiInput.elem.value ? '1' : '';
			emojiHint.elem.textContent = emojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		this.form = new Form({
			appendTo: this.body,
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
					attributes: { list: datalistId },
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
						{ label: '✓ Active', value: '' },
						{ label: '🔩 Needs maintenance', value: 'needs_maintenance' },
						{ label: '🔧 Needs service', value: 'needs_service' },
						{ label: '⚠️ Out of service', value: 'out_of_service' },
						{ label: '☠️ Destroyed', value: 'destroyed' },
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
		});

		this._getEmoji = () => {
			const auto = equipmentEmoji(this.form.options.data.type || '');

			return emojiInput.elem.value !== auto ? emojiInput.elem.value : '';
		};

		const { collect: collectProps } = makePropertiesEditor(this.body, item.properties || {});

		this._collectProps = collectProps;

		// Show label toggle
		const _cbUniqueId = `lbl-${Math.random().toString(36).slice(2)}`;

		const labelRow = new Elem({
			tag: 'div',
			style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' },
			appendTo: this.body,
		});

		this._showLabelEl = new Elem({
			tag: 'input',
			attributes: { type: 'checkbox', id: _cbUniqueId },
			style: { accentColor: '#4a90d9' },
			appendTo: labelRow,
		});
		this._showLabelEl.elem.checked = item.showLabel !== false;

		new Elem({
			tag: 'label',
			textContent: 'Show name label on map',
			attributes: { for: _cbUniqueId },
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' },
			appendTo: labelRow,
		});
	}
}
