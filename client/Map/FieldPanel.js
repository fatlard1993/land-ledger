import { Component, Elem, Button, Icon, Dialog } from '@vanilla-bean/components';

import { geodesicAreaSqm, convertArea, formatArea, AREA_UNITS } from '../geo';
import parseDetails from '../utils/parseDetails';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { formatDollar } from '../utils/format';

import { getEvents, updateEvent, getMaintenance, getMaintenanceSchedules, updateEquipment } from '../api';
import { categoryMeta, eventEmoji } from '../Timeline/EventDialog';
import { FieldPanel as StyledPanel, PanelHandle, SectionHeader, DetailRow, TenureBadge } from '../Layout';
import context from '../context';
import EventDialog from '../Timeline/EventDialog';
import SeasonCharts from '../Charts/SeasonCharts';
import { scheduleStatus } from '../utils/maintenanceUtils';
import { buildingEmoji } from './BuildingDialog';
import { equipmentEmoji } from './EquipmentDialog';
import { detectPathEmoji, PATH_COLORS } from './PathDialog';
import { renderWeatherStrip } from './FieldWeather';
import { renderPrecisionLayersSection } from './PrecisionLayerPanel';
import { renderEconomics } from './FieldEconomics';
import { renderFeedingSection } from './FeedingSection';
import { renderMaintenanceSection } from './EquipmentSection';
import { renderLeasesToggle } from './EntityLeases';
import { renderIncidents } from './EntityIncidents';
import { renderBuildingInventory, renderEntityRevenue, renderBudgetItems } from './BuildingSection';
import { openSellDialog } from './EntityRevenue';

const INPUT_STYLE = {
	display: 'block',
	width: '100%',
	background: 'rgba(255,255,255,0.07)',
	border: '1px solid rgba(255,255,255,0.12)',
	borderRadius: '4px',
	color: '#fff',
	fontSize: '16px',
	padding: '8px 10px',
	boxSizing: 'border-box',
	marginTop: '4px',
	fontFamily: 'inherit',
	appearance: 'none',
	webkitAppearance: 'none',
};

const LABEL_STYLE = {
	display: 'block',
	fontSize: '11px',
	textTransform: 'uppercase',
	letterSpacing: '0.08em',
	color: 'rgba(255,255,255,0.45)',
	marginTop: '10px',
};

const FIELD_STATUSES = [
	{ value: '', label: '✓ Active' },
	{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
	{ value: 'needs_service', label: '🔧 Needs service' },
	{ value: 'out_of_service', label: '⚠️ Out of service' },
	{ value: 'fallow', label: '😴 Fallow' },
	{ value: 'abandoned', label: '🏚️ Abandoned' },
	{ value: 'destroyed', label: '☠️ Destroyed' },
];

const EDIT_FIELDS = [
	{ key: 'name', label: 'Field Name', placeholder: 'e.g. Home Farm North' },
	{
		key: 'tenure',
		label: 'Tenure',
		options: [
			{ value: 'own', label: 'Owned' },
			{ value: 'rent', label: 'Rented' },
		],
	},
	{ key: 'status', label: 'Status', options: FIELD_STATUSES },
	{ key: 'acreage', label: 'Acreage', placeholder: 'e.g. 143.5', type: 'number' },
	{ key: 'trialGroup', label: 'Trial Group', placeholder: 'e.g. FLOURISH 2024' },
	{
		key: 'trialRole',
		label: 'Trial Role',
		options: [
			{ value: '', label: 'None' },
			{ value: 'treatment', label: 'Treatment' },
			{ value: 'control', label: 'Control' },
		],
	},
];

export default class FieldPanel extends Component {
	constructor(options = {}) {
		super({ autoRender: false, ...options });
	}

	_initDragToClose() {
		const el = this.panel.elem;
		let startY = 0;
		let startScrollTop = 0;
		let dragging = false;
		let dragBlocked = false; // blocked when content is scrolled

		el.addEventListener(
			'touchstart',
			e => {
				// Only start drag from near the top (handle area, ~60px)
				const touch = e.touches[0];
				const rect = el.getBoundingClientRect();
				const localY = touch.clientY - rect.top;

				startY = touch.clientY;
				startScrollTop = el.scrollTop;
				dragging = localY < 60; // handle zone
				dragBlocked = false;
			},
			{ passive: true },
		);

		el.addEventListener(
			'touchmove',
			e => {
				if (!dragging) return;

				const dy = e.touches[0].clientY - startY;

				// If content is scrolled up, don't drag
				if (el.scrollTop > 0 || (dy < 0 && startScrollTop === 0)) {
					dragBlocked = true;
				}

				if (dragBlocked) return;

				if (dy > 0) {
					// Apply drag translation without transition
					el.style.transition = 'none';
					el.style.transform = `translateY(${dy}px)`;

					if (e.cancelable) e.preventDefault();
				}
			},
			{ passive: false },
		);

		el.addEventListener(
			'touchend',
			e => {
				if (!dragging || dragBlocked) {
					dragging = false;
					return;
				}

				const dy = e.changedTouches[0].clientY - startY;
				const threshold = Math.min(120, el.offsetHeight * 0.25);

				el.style.transition = '';
				el.style.transform = '';

				if (dy > threshold) {
					this.hide();
				}

				dragging = false;
			},
			{ passive: true },
		);
	}

	_mkLabelToggle(defaultOn = true) {
		const uniqueId = `lbl-toggle-${Math.random().toString(36).slice(2)}`;
		const row = new Component({
			appendTo: this._content,
			style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' },
		});
		const cb = new Elem({ tag: 'input', appendTo: row, attributes: { id: uniqueId } });

		cb.elem.type = 'checkbox';
		cb.elem.checked = defaultOn;
		cb.elem.style.accentColor = '#4a90d9';

		const label = new Elem({ tag: 'label', appendTo: row, textContent: 'Show name label on map' });

		label.elem.htmlFor = uniqueId;
		label.setStyle({ fontSize: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', userSelect: 'none' });

		return cb.elem;
	}

	build() {
		this._escHandler = e => {
			if (e.key === 'Escape' && this.panel?.hasClass('open')) this.hide();
		};

		document.addEventListener('keydown', this._escHandler);
		this.addCleanup('esc', () => document.removeEventListener('keydown', this._escHandler));

		this.addClass('field-panel-outer');

		if (!document.getElementById('field-panel-outer-style')) {
			const s = document.createElement('style');

			s.id = 'field-panel-outer-style';
			s.textContent = `
				@media (min-width: 768px) {
					.field-panel-outer { flex-shrink: 0; width: 0; overflow: hidden; transition: width 0.3s ease; }
					.field-panel-outer.open { width: 340px; }
				}
			`;
			document.head.append(s);
		}

		this.panel = new StyledPanel({ appendTo: this });

		new PanelHandle({ appendTo: this.panel });

		this._initDragToClose();

		const header = new Component({
			appendTo: this.panel,
			style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
		});

		this._titleElem = new Elem({
			tag: 'span',
			appendTo: header,
			style: {
				fontSize: '18px',
				fontWeight: '700',
				flex: '1',
				marginRight: '8px',
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
			},
		});

		this._presenceIndicator = new Elem({
			tag: 'span',
			appendTo: header,
			style: {
				display: 'none',
				fontSize: '10px',
				padding: '1px 7px',
				borderRadius: '10px',
				background: 'rgba(232,196,42,0.15)',
				border: '1px solid rgba(232,196,42,0.35)',
				color: '#e8c42a',
				fontWeight: '600',
				flexShrink: '0',
				marginRight: '6px',
				alignItems: 'center',
				whiteSpace: 'nowrap',
			},
		});

		this._actions = new Component({ appendTo: header, style: { display: 'flex', gap: '6px', flexShrink: '0' } });

		this._editBtn = new Button({ appendTo: this._actions, append: new Icon({ icon: 'pen' }), title: 'Edit details' });
		this._editBoundaryBtn = new Button({
			appendTo: this._actions,
			append: new Icon({ icon: 'draw-polygon' }),
			title: 'Edit boundary',
		});
		this._moveBtn = new Button({
			appendTo: this._actions,
			append: new Icon({ icon: 'location-crosshairs' }),
			title: 'Move to new position',
		});
		this._sellBtn = new Button({
			appendTo: this._actions,
			append: new Icon({ icon: 'tag' }),
			title: 'Record sale of this asset',
			style: { color: '#4caf50' },
		});
		this._deleteBtn = new Button({
			appendTo: this._actions,
			append: new Icon({ icon: 'trash' }),
			title: 'Delete field',
			style: { color: '#e05252' },
		});
		new Button({
			appendTo: this._actions,
			append: new Icon({ icon: 'xmark' }),
			title: 'Close',
			onPointerPress: () => this.hide(),
		});

		this._configureButtons();

		this._metaElem = new Component({
			appendTo: this.panel,
			style: { display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' },
		});
		this._content = new Component({ appendTo: this.panel });
	}

	_configureButtons({ edit = false, editBoundary = false, move = false, sell = false, del = false } = {}) {
		this._editBtn.setStyle({ display: edit ? '' : 'none' });
		this._editBoundaryBtn.setStyle({ display: editBoundary ? '' : 'none' });
		this._moveBtn.setStyle({ display: move ? '' : 'none' });
		this._sellBtn.setStyle({ display: sell ? '' : 'none' });
		this._deleteBtn.setStyle({ display: del ? '' : 'none' });
	}

	async showField(
		field,
		{ events: passedEvents, allEvents: passedAllEvents, allFields: passedAllFields, ...callbacks } = {},
	) {
		if (!this.rendered) this.render();
		this._dismissCurrent();

		this._field = field;
		this._callbacks = callbacks;
		this._passedEvents = passedEvents || null;
		this._allEvents = passedAllEvents || null;
		this._allFields = passedAllFields || null;

		await this._renderViewMode();
		this.panel.addClass('open');
		this.addClass('open');
		this._watchEntity('fields', field.id);
	}

	_parseContents(contents) {
		if (!contents) return [];
		if (Array.isArray(contents)) return contents;

		try {
			return JSON.parse(contents);
		} catch {
			return [];
		}
	}

	hide() {
		this.panel.removeClass('open');
		this.removeClass('open');
		// Call onHide for whichever entity type is currently shown
		this._callbacks?.onHide?.();
		this._entity?.callbacks?.onHide?.();
		// Clear refs so we don't double-fire on the next hide()
		if (this._callbacks) this._callbacks = { ...this._callbacks, onHide: null };
		if (this._entity?.callbacks) this._entity.callbacks = { ...this._entity.callbacks, onHide: null };
		this._clearSyncListener();
	}

	_dismissCurrent() {
		// Fire onHide for the current entity before showing a new one
		this._callbacks?.onHide?.();
		this._entity?.callbacks?.onHide?.();
		this._clearSyncListener();
	}

	// Register presence + change/presence listeners for the currently-open entity.
	// Shows a presence indicator in the header when others have the same record open,
	// and an inline banner when the record is saved by another device.
	_watchEntity(collection, id) {
		this._clearSyncListener();

		fetch('/presence', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ collection, id, action: 'open' }),
		}).catch(() => {});
		this._watchingPresence = { collection, id };

		const changeHandler = e => {
			if (e.detail.collection !== collection || e.detail.id !== id) return;
			if (this._staleBanner) return;

			this._staleBanner = new Elem({
				tag: 'div',
				style: {
					background: 'rgba(232,196,42,0.15)',
					border: '1px solid rgba(232,196,42,0.4)',
					borderRadius: '4px',
					padding: '7px 10px',
					fontSize: '12px',
					color: '#e8c42a',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '8px',
					marginBottom: '8px',
				},
			});

			new Elem({ tag: 'span', appendTo: this._staleBanner, textContent: 'This record was updated on another device.' });

			new Button({
				appendTo: this._staleBanner,
				textContent: 'Refresh',
				style: {
					background: 'rgba(232,196,42,0.2)',
					border: '1px solid rgba(232,196,42,0.5)',
					color: '#e8c42a',
					fontSize: '11px',
					padding: '2px 8px',
					borderRadius: '3px',
					cursor: 'pointer',
					flexShrink: '0',
				},
				onPointerPress: () => location.reload(),
			});

			this._content.elem.prepend(this._staleBanner.elem);
		};

		const presenceHandler = e => {
			if (e.detail.collection !== collection || e.detail.id !== id) return;
			const others = e.detail.count - 1; // count includes this client
			if (others > 0) {
				this._presenceIndicator.elem.textContent = `● ${others} other${others !== 1 ? 's' : ''}`;
				this._presenceIndicator.elem.style.display = 'inline-flex';
			} else {
				this._presenceIndicator.elem.style.display = 'none';
			}
		};

		document.addEventListener('livesync:change', changeHandler);
		document.addEventListener('livesync:presence', presenceHandler);
		this._syncListener = changeHandler;
		this._presenceListener = presenceHandler;
	}

	_clearSyncListener() {
		if (this._syncListener) {
			document.removeEventListener('livesync:change', this._syncListener);
			this._syncListener = null;
		}
		if (this._presenceListener) {
			document.removeEventListener('livesync:presence', this._presenceListener);
			this._presenceListener = null;
		}
		if (this._watchingPresence) {
			const { collection, id } = this._watchingPresence;
			fetch('/presence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ collection, id, action: 'close' }),
			}).catch(() => {});
			this._watchingPresence = null;
		}
		if (this._presenceIndicator) this._presenceIndicator.elem.style.display = 'none';
		this._staleBanner?.elem?.remove();
		this._staleBanner = null;
	}

	destroy() {
		document.removeEventListener('keydown', this._escHandler);
		this._clearSyncListener();
	}

	async showPath(path, callbacks = {}) {
		if (!this.rendered) this.render();
		this._dismissCurrent();

		this._entity = { type: 'path', data: path, callbacks };
		this._renderPathView();
		this.panel.addClass('open');
		this.addClass('open');
		this._watchEntity('paths', path.id);
	}

	_renderPathView() {
		const { data: p, callbacks } = this._entity;

		const pathEmoji = detectPathEmoji(p.type, p.emoji);
		this._titleElem.elem.textContent = `${pathEmoji} ${p.name || p.type || 'Path'}`;
		this._editBoundaryBtn.elem.title = 'Edit path line';
		this._configureButtons({ edit: true, editBoundary: !!p.geometry, del: true });

		this._editBtn.options.onPointerPress = () => this._renderPathEdit();
		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditPath;

		this._deleteBtn.options.onPointerPress = async () => {
			if (await Dialog.confirm({ header: `Delete "${p.name || 'this path'}"?`, confirmLabel: 'Delete' }))
				callbacks.onDelete?.();
		};

		this._metaElem.empty();
		if (p.type)
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
				textContent: p.type,
			});
		if (p.widthFt)
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.45)' },
				textContent: `${p.widthFt} ft wide`,
			});

		this._content.empty();

		new SectionHeader({ appendTo: this._content, textContent: 'Path / Road' });

		const PATH_STATUS_LABELS = {
			needs_maintenance: '🔩 Needs maintenance',
			needs_service: '🔧 Needs service',
			out_of_service: '⚠️ Out of service',
			closed: '🚫 Closed',
			destroyed: '☠️ Destroyed',
		};
		const rows = [
			p.status ? ['Status', PATH_STATUS_LABELS[p.status] || p.status] : null,
			['Type', p.type],
			['Width', p.widthFt ? `${p.widthFt} ft` : null],
			p.color ? ['Color', null, p.color] : null,
		].filter(r => r && (r[1] || r[2]));

		for (const [label, value, colorSwatch] of rows) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: label });

			if (colorSwatch) {
				const swatch = new Elem({ tag: 'span', appendTo: row, addClass: 'value' });

				swatch.elem.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${colorSwatch};vertical-align:middle;margin-right:5px;"></span>${colorSwatch}`;
			} else {
				new Elem({ tag: 'span', appendTo: row, addClass: 'value', textContent: value });
			}
		}

		this._renderProperties(p.properties, this._content);
	}

	_renderPathEdit() {
		const { data: p, callbacks } = this._entity;

		this._titleElem.elem.textContent = 'Edit Path';
		this._configureButtons();
		this._metaElem.empty();
		this._content.empty();

		// Emoji row
		const emojiRow = new Component({
			appendTo: this._content,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px' },
		});
		const emojiInput = new Elem({ tag: 'input', appendTo: emojiRow });

		Object.assign(emojiInput.elem, { type: 'text', maxLength: 4, value: p.emoji || detectPathEmoji(p.type || '') });
		emojiInput.setStyle({
			...INPUT_STYLE,
			width: '52px',
			textAlign: 'center',
			fontSize: '22px',
			padding: '4px',
			flexShrink: '0',
		});
		emojiInput.elem.title = 'Tap to change emoji';

		const emojiHint = new Elem({ tag: 'span', appendTo: emojiRow });

		emojiHint.setStyle({ fontSize: '11px', color: 'rgba(255,255,255,0.3)' });
		emojiHint.elem.textContent = 'Auto-detected · tap to change';

		emojiInput.elem.addEventListener('input', () => {
			emojiHint.elem.textContent = emojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		const getters = {};

		for (const { key, label, placeholder, type } of [
			{ key: 'name', label: 'Name', placeholder: 'e.g. North Lane' },
			{ key: 'type', label: 'Type', placeholder: 'e.g. Driveway, Farm road, Trail' },
			{ key: 'widthFt', label: 'Width (feet)', placeholder: '10', type: 'number' },
		]) {
			new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: label });
			const input = new Elem({ tag: 'input', appendTo: this._content });
			Object.assign(input.elem, { type: type || 'text', placeholder: placeholder || '', value: p[key] || '' });
			Object.assign(input.elem.style, INPUT_STYLE);
			getters[key] = () => input.elem.value;
			// Auto-update emoji when type changes
			if (key === 'type')
				input.elem.addEventListener('input', () => {
					if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = detectPathEmoji(input.elem.value);
				});
		}

		// Color picker
		new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: 'Surface / Color' });

		let selectedColor = p.color || '#8B6914';
		const colorGrid = new Component({
			appendTo: this._content,
			style: {
				display: 'grid',
				gridTemplateColumns: 'repeat(4, 1fr)',
				gap: '4px',
				marginTop: '4px',
				marginBottom: '8px',
			},
		});

		for (const { value, label } of PATH_COLORS) {
			const btn = new Component({
				tag: 'button',
				appendTo: colorGrid,
				textContent: label,
				style: {
					background: value === selectedColor ? `${value}44` : 'transparent',
					border: `2px solid ${value}`,
					borderRadius: '6px',
					color: '#fff',
					cursor: 'pointer',
					fontSize: '11px',
					padding: '5px 4px',
				},
				onPointerPress: () => {
					selectedColor = value;
					Array.from(colorGrid.elem.children).forEach(b => {
						b.style.background = 'transparent';
					});
					btn.elem.style.background = `${value}44`;
				},
			});
			btn.elem.type = 'button';
		}

		new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: 'Status' });
		const pathStatusSelect = new Elem({ tag: 'select', appendTo: this._content });

		pathStatusSelect.setStyle({ ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' });
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
			pathStatusSelect.elem.append(o);
		});
		pathStatusSelect.elem.value = p.status || '';

		const pathLabelCb = this._mkLabelToggle(p.showLabel === true);

		const { collect: collectPathProps } = makePropertiesEditor(this._content, p.properties || {});

		const buttons = new Component({
			appendTo: this._content,
			style: { display: 'flex', gap: '8px', marginTop: '16px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			style: { flex: '1' },
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				const autoEmoji = detectPathEmoji(data.type || '');

				data.emoji = emojiInput.elem.value !== autoEmoji ? emojiInput.elem.value : '';
				data.color = selectedColor;
				data.status = pathStatusSelect.elem.value;
				data.showLabel = pathLabelCb.checked;
				data.properties = collectPathProps();
				data.geometry = p.geometry;

				const updated = await callbacks.onSave?.(data);

				if (updated) this._entity.data = updated;
				this._renderPathView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			style: { flex: '1' },
			onPointerPress: () => this._renderPathView(),
		});
	}

	async showParcel(parcel, callbacks = {}) {
		if (!this.rendered) this.render();
		this._dismissCurrent();

		this._entity = { type: 'parcel', data: parcel, callbacks };
		this._renderParcelView();
		this.panel.addClass('open');
		this.addClass('open');
		this._watchEntity('parcels', parcel.id);
	}

	async _renderParcelView() {
		const { data: p, callbacks } = this._entity;

		this._titleElem.elem.textContent = `📐 ${p.name || p.parcelId || 'Property Line'}`;
		this._editBoundaryBtn.elem.title = 'Edit boundary';
		this._configureButtons({ edit: true, editBoundary: !!p.geometry, sell: true, del: true });

		this._editBtn.options.onPointerPress = () => this._renderParcelEdit();
		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditBoundary;

		this._sellBtn.options.onPointerPress = () =>
			openSellDialog(
				'parcel',
				p,
				() => {
					callbacks.onDelete?.();
				},
				() => this.hide(),
			);

		this._deleteBtn.options.onPointerPress = async () => {
			if (await Dialog.confirm({ header: `Delete this property line?`, confirmLabel: 'Delete' }))
				callbacks.onDelete?.();
		};

		this._metaElem.empty();
		if (p.acreage)
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
				textContent: formatArea(p.acreage, p.acreageUnit || 'ac'),
			});

		this._content.empty();

		new SectionHeader({ appendTo: this._content, textContent: 'Property Line' });

		const PARCEL_STATUS_LABELS = {
			needs_maintenance: '🔩 Needs maintenance',
			out_of_service: '⚠️ Out of service',
			disputed: '⚖️ Disputed',
			encumbered: '🔒 Encumbered',
			destroyed: '☠️ Destroyed',
		};
		if (p.status) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: 'Status' });
			new Elem({
				tag: 'span',
				appendTo: row,
				addClass: 'value',
				textContent: PARCEL_STATUS_LABELS[p.status] || p.status,
			});
		}

		this._renderProperties(p.properties, this._content);

		await renderLeasesToggle('parcel', p, () => this._renderParcelView(), this._content);
		await renderIncidents('parcel', p, () => this._renderParcelView(), this._content);
	}

	async _renderParcelEdit() {
		const { data: p, callbacks } = this._entity;

		this._titleElem.elem.textContent = 'Edit Property Line';
		this._configureButtons();
		this._metaElem.empty();
		this._content.empty();

		const getters = {};

		for (const { key, label, placeholder, options } of [
			{ key: 'name', label: 'Description', placeholder: 'e.g. North Parcel' },
			{
				key: 'status',
				label: 'Status',
				options: [
					{ value: '', label: '✓ Active' },
					{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
					{ value: 'out_of_service', label: '⚠️ Out of service' },
					{ value: 'disputed', label: '⚖️ Disputed' },
					{ value: 'encumbered', label: '🔒 Encumbered' },
					{ value: 'destroyed', label: '☠️ Destroyed' },
				],
			},
		]) {
			new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: label });

			if (options) {
				const select = new Elem({ tag: 'select', appendTo: this._content });

				select.setStyle({ ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' });
				options.forEach(({ value, label: optionLabel }) => {
					const o = document.createElement('option');
					o.value = value;
					o.textContent = optionLabel;
					select.elem.append(o);
				});
				select.elem.value = p[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Elem({ tag: 'input', appendTo: this._content });

				Object.assign(input.elem, { type: 'text', placeholder: placeholder || '', value: p[key] || '' });
				Object.assign(input.elem.style, INPUT_STYLE);
				getters[key] = () => input.elem.value;
			}
		}

		// Area row — same pattern as field inline edit
		new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: 'Area' });

		const areaRow = new Elem({
			tag: 'div',
			appendTo: this._content,
			style: {
				display: 'flex',
				alignItems: 'center',
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				overflow: 'hidden',
				marginTop: '4px',
			},
		});

		const currentUnit = p.acreageUnit || 'ac';
		const sqm = p.geometry ? geodesicAreaSqm(p.geometry) : null;
		const defaultArea = p.acreage || (sqm ? convertArea(sqm, currentUnit) : '') || '';
		const unitMeta = AREA_UNITS.find(u => u.value === currentUnit) || AREA_UNITS[1];

		const areaInput = new Elem({ tag: 'input', appendTo: areaRow });

		Object.assign(areaInput.elem, {
			type: 'number',
			step: '0.01',
			min: '0',
			placeholder: 'Size',
			value: defaultArea ? Number(defaultArea).toFixed(unitMeta.decimals) : '',
		});
		Object.assign(areaInput.elem.style, {
			...INPUT_STYLE,
			border: 'none',
			background: 'transparent',
			flex: '1',
			marginTop: '0',
		});

		const unitSelect = new Elem({ tag: 'select', appendTo: areaRow });

		unitSelect.setStyle({
			background: 'transparent',
			border: 'none',
			borderLeft: '1px solid rgba(255,255,255,0.12)',
			color: '#fff',
			cursor: 'pointer',
			fontSize: '13px',
			padding: '7px 4px',
			fontFamily: 'inherit',
			flexShrink: '0',
			outline: 'none',
			width: '54px',
		});

		for (const { value: unitValue, label } of AREA_UNITS) {
			const opt = document.createElement('option');
			opt.value = unitValue;
			opt.textContent = label;
			opt.style.background = '#1a1a1a';
			unitSelect.elem.append(opt);
		}

		unitSelect.elem.value = currentUnit;
		unitSelect.elem.addEventListener('change', () => {
			if (!sqm) return;
			const meta = AREA_UNITS.find(u => u.value === unitSelect.elem.value) || AREA_UNITS[1];
			areaInput.elem.value = convertArea(sqm, unitSelect.elem.value).toFixed(meta.decimals);
		});

		if (sqm) {
			new Button({
				appendTo: areaRow,
				textContent: '↺',
				title: 'Calculate from boundary',
				style: {
					borderRadius: '0',
					borderLeft: '1px solid rgba(255,255,255,0.12)',
					padding: '7px 9px',
					fontSize: '13px',
					flexShrink: '0',
				},
				onPointerPress: () => {
					const meta = AREA_UNITS.find(u => u.value === unitSelect.elem.value) || AREA_UNITS[1];
					areaInput.elem.value = convertArea(sqm, unitSelect.elem.value).toFixed(meta.decimals);
				},
			});
		}

		getters.acreage = () => areaInput.elem.value;
		getters.acreageUnit = () => unitSelect.elem.value;

		const parcelLabelCb = this._mkLabelToggle(p.showLabel !== false);

		getters['showLabel'] = () => parcelLabelCb.checked;

		const { collect: collectParcelProps } = makePropertiesEditor(this._content, p.properties || {});

		getters['properties'] = collectParcelProps;

		const buttons = new Component({
			appendTo: this._content,
			style: { display: 'flex', gap: '8px', marginTop: '16px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			style: { flex: '1' },
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				const updated = await callbacks.onSave?.(data);
				if (updated) this._entity.data = updated;
				this._renderParcelView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			style: { flex: '1' },
			onPointerPress: () => this._renderParcelView(),
		});
	}

	async showBuilding(building, callbacks = {}) {
		if (!this.rendered) this.render();
		this._dismissCurrent();

		this._entity = { type: 'building', data: building, callbacks };
		this._renderBuildingView();
		this.panel.addClass('open');
		this.addClass('open');
		this._watchEntity('buildings', building.id);
	}

	async showEquipment(item, callbacks = {}) {
		if (!this.rendered) this.render();
		this._dismissCurrent();

		this._entity = { type: 'equipment', data: item, callbacks };
		this._renderEquipmentView();
		this.panel.addClass('open');
		this.addClass('open');
		this._watchEntity('equipment', item.id);
	}

	async _renderBuildingView() {
		const { data: b, callbacks } = this._entity;
		const emoji = buildingEmoji(b.type);
		this._titleElem.elem.textContent = `${emoji} ${b.name || 'Building'}`;
		this._editBoundaryBtn.elem.title = 'Edit boundary';
		this._configureButtons({ edit: true, editBoundary: !!b.geometry, del: true });

		this._editBtn.options.onPointerPress = () => this._renderBuildingEdit();
		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditBoundary;

		this._deleteBtn.options.onPointerPress = async () => {
			if (await Dialog.confirm({ header: `Delete "${b.name || 'this building'}"?`, confirmLabel: 'Delete' }))
				callbacks.onDelete?.();
		};

		this._metaElem.empty();
		if (b.type)
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
				textContent: b.type,
			});

		this._content.empty();

		new SectionHeader({ appendTo: this._content, textContent: 'Building' });

		if (b.type) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: 'Type' });
			new Elem({ tag: 'span', appendTo: row, addClass: 'value', textContent: b.type });
		}

		this._renderProperties(b.properties, this._content);

		await this._renderBuildingActivity(b);
		await renderBuildingInventory(b, () => this._renderBuildingView(), this._content);
		await renderEntityRevenue('building', b, () => this._renderBuildingView(), this._content);
		await renderBudgetItems('building', b, () => this._renderBuildingView(), this._content);
		await renderLeasesToggle('building', b, () => this._renderBuildingView(), this._content);
		await renderIncidents('building', b, () => this._renderBuildingView(), this._content);
	}

	async _renderBuildingActivity(building) {
		const eventsData = this._passedEvents ? null : await getEvents();
		const events = (this._passedEvents || Object.values(eventsData?.body || {}))
			.filter(e => e.fieldId === building.id)
			.sort((a, b) => new Date(b.date) - new Date(a.date));

		const header = new Component({
			appendTo: this._content,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
		});

		new SectionHeader({ appendTo: header, textContent: 'Activity' });

		const actButtons = new Component({ appendTo: header, style: { display: 'flex', gap: '6px', marginTop: '10px' } });

		new Button({
			appendTo: actButtons,
			textContent: '+ Event',
			style: { fontSize: '11px', padding: '2px 8px' },
			onPointerPress: () =>
				new EventDialog({
					fieldId: building.id,
					onSave: async data => {
						await import('../api').then(({ createEvent }) => createEvent({ body: data }));
						this._renderBuildingView();
					},
				}),
		});

		if (events.length) {
			new Button({
				appendTo: actButtons,
				textContent: 'All →',
				style: { fontSize: '11px', padding: '2px 6px' },
				onPointerPress: () => {
					context.timelineFieldFilter = building.id;
					window.location.hash = '/Timeline';
					this.hide();
				},
			});
		}

		if (!events.length) {
			new Elem({
				tag: 'div',
				appendTo: this._content,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '5px 0 8px' },
				textContent: 'No activity recorded',
			});
			return;
		}

		for (const event of events.slice(0, 8)) {
			const d = parseDetails(event.details);
			const emoji = eventEmoji(event);
			const meta = categoryMeta(event.category);

			const row = new Component({
				appendTo: this._content,
				style: {
					display: 'flex',
					gap: '8px',
					fontSize: '12px',
					padding: '4px 0',
					borderBottom: '1px solid rgba(255,255,255,0.05)',
					alignItems: 'flex-start',
					cursor: 'pointer',
				},
			});

			new Elem({ tag: 'span', appendTo: row, style: { flexShrink: '0', fontSize: '14px' }, textContent: emoji });

			const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

			new Elem({
				tag: 'div',
				appendTo: info,
				style: { color: '#fff' },
				textContent: event.name || meta?.label || event.category,
			});

			const eventMeta = [
				event.date ? new Date(event.date).toLocaleDateString() : null,
				d.species || null,
				d.headCount ? `${d.headCount} hd` : null,
				d.quantity ? `${d.quantity} ${d.unit || ''}`.trim() : null,
			].filter(Boolean);

			if (eventMeta.length)
				new Elem({
					tag: 'div',
					appendTo: info,
					style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
					textContent: eventMeta.join(' · '),
				});

			row.onPointerPress(
				() =>
					new EventDialog({
						event: event,
						onSave: async data => {
							await updateEvent(event.id, { body: { ...data, _v: event._v } });
							this._renderBuildingView();
						},
						onDelete: async () => {
							await import('../api').then(({ deleteEvent }) => deleteEvent(event.id));
							this._renderBuildingView();
						},
					}),
			);
		}
	}

	async _renderBuildingEdit() {
		const { data: b, callbacks } = this._entity;

		this._titleElem.elem.textContent = 'Edit Building';
		this._configureButtons();
		this._metaElem.empty();
		this._content.empty();

		// Emoji row
		const bldgEmojiRow = new Component({
			appendTo: this._content,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px' },
		});
		const bldgEmojiInput = new Elem({ tag: 'input', appendTo: bldgEmojiRow });

		Object.assign(bldgEmojiInput.elem, { type: 'text', maxLength: 4, value: b.emoji || buildingEmoji(b.type || '') });
		bldgEmojiInput.setStyle({
			...INPUT_STYLE,
			width: '52px',
			textAlign: 'center',
			fontSize: '22px',
			padding: '4px',
			flexShrink: '0',
		});
		bldgEmojiInput.elem.title = 'Tap to change emoji';

		const bldgEmojiHint = new Elem({ tag: 'span', appendTo: bldgEmojiRow });

		bldgEmojiHint.setStyle({ fontSize: '11px', color: 'rgba(255,255,255,0.3)' });
		bldgEmojiHint.elem.textContent = b.emoji ? 'Custom · clear to auto-detect' : 'Auto-detected · tap to change';

		bldgEmojiInput.elem.addEventListener('input', () => {
			bldgEmojiInput.elem.dataset.manual = bldgEmojiInput.elem.value ? '1' : '';
			bldgEmojiHint.elem.textContent = bldgEmojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		const getters = {};

		for (const { key, label, placeholder, options } of [
			{ key: 'name', label: 'Name', placeholder: 'Building name' },
			{ key: 'type', label: 'Type', placeholder: 'e.g. Barn, Machine shed, Grain bin' },
			{
				key: 'status',
				label: 'Status',
				options: [
					{ value: '', label: '✓ Active' },
					{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
					{ value: 'needs_service', label: '🔧 Needs service' },
					{ value: 'out_of_service', label: '⚠️ Out of service' },
					{ value: 'destroyed', label: '☠️ Destroyed' },
				],
			},
		]) {
			new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: label });

			if (options) {
				const select = new Elem({ tag: 'select', appendTo: this._content });

				select.setStyle({ ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' });
				options.forEach(({ value, label: optionLabel }) => {
					const o = document.createElement('option');
					o.value = value;
					o.textContent = optionLabel;
					select.elem.append(o);
				});
				select.elem.value = b[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Elem({ tag: 'input', appendTo: this._content });

				Object.assign(input.elem, { type: 'text', placeholder: placeholder || '', value: b[key] || '' });
				Object.assign(input.elem.style, INPUT_STYLE);
				getters[key] = () => input.elem.value;
				// Auto-update emoji when type changes
				if (key === 'type')
					input.elem.addEventListener('input', () => {
						if (!bldgEmojiInput.elem.dataset.manual) bldgEmojiInput.elem.value = buildingEmoji(input.elem.value);
					});
			}
		}

		const bldgLabelCb = this._mkLabelToggle(b.showLabel !== false);

		getters['emoji'] = () => {
			const auto = buildingEmoji(getters.type());
			return bldgEmojiInput.elem.value !== auto ? bldgEmojiInput.elem.value : '';
		};

		getters['showLabel'] = () => bldgLabelCb.checked;

		const { collect: collectBldgProps } = makePropertiesEditor(this._content, b.properties || {});

		getters['properties'] = collectBldgProps;

		const buttons = new Component({
			appendTo: this._content,
			style: { display: 'flex', gap: '8px', marginTop: '16px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			style: { flex: '1' },
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				const updated = await callbacks.onSave?.(data);
				if (updated) {
					this._entity.data = updated;
				}
				this._renderBuildingView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			style: { flex: '1' },
			onPointerPress: () => this._renderBuildingView(),
		});
	}

	async _renderEquipmentView() {
		const { data: item, callbacks } = this._entity;
		const emoji = equipmentEmoji(item.type, item.emoji);

		this._titleElem.elem.textContent = `${emoji} ${item.name || 'Equipment'}`;
		this._configureButtons({ edit: true, move: true, sell: true, del: true });

		this._editBtn.options.onPointerPress = () => this._renderEquipmentEdit();
		this._moveBtn.options.onPointerPress = () => {
			callbacks.onMovePin?.();
			this.hide();
		};

		this._sellBtn.options.onPointerPress = () =>
			openSellDialog(
				'equipment',
				item,
				() => {
					callbacks.onDelete?.();
				},
				() => this.hide(),
			);

		this._deleteBtn.options.onPointerPress = async () => {
			if (await Dialog.confirm({ header: `Delete "${item.name || 'this equipment'}"?`, confirmLabel: 'Delete' }))
				callbacks.onDelete?.();
		};

		this._metaElem.empty();
		if (item.tenure) {
			const color = item.tenure === 'own' ? '#4a90d9' : '#e8832a';
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '12px', padding: '2px 7px', borderRadius: '4px', background: `${color}22`, color },
				textContent: item.tenure === 'own' ? 'Owned' : 'Leased',
			});
		}
		if (item.type)
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
				textContent: item.type,
			});

		this._content.empty();

		new SectionHeader({ appendTo: this._content, textContent: 'Equipment' });

		const formatCoordinate = n => (n != null ? Number(n).toFixed(5) : null);
		const lat = formatCoordinate(item.lat);
		const lng = formatCoordinate(item.lng);

		const STATUS_LABELS = {
			needs_maintenance: '🔩 Needs maintenance',
			needs_service: '🔧 Needs service',
			out_of_service: '⚠️ Out of service',
			destroyed: '☠️ Destroyed',
		};
		const STATUS_COLORS = {
			needs_maintenance: '#e8832a',
			needs_service: '#e8c42a',
			out_of_service: '#888',
			destroyed: '#c62828',
		};

		const rows = [
			['Type', item.type],
			item.status ? ['Status', STATUS_LABELS[item.status] || item.status] : null,
			item.usage
				? ['Usage', `${Number(item.usage).toLocaleString()}${item.usageUnit ? ' ' + item.usageUnit : ''}`]
				: null,
			['Location', lat && lng ? `${lat}°, ${lng}°` : null],
		].filter(r => r && r[1]);

		for (const [label, value] of rows) {
			const row = new DetailRow({ appendTo: this._content });
			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: label });
			const color = label === 'Status' ? STATUS_COLORS[item.status] || null : null;
			new Elem({ tag: 'span', appendTo: row, addClass: 'value', style: color ? { color } : {}, textContent: value });
		}

		this._renderProperties(item.properties, this._content);

		// Load maintenance data
		const [maintenanceData, scheduleData] = await Promise.all([getMaintenance(), getMaintenanceSchedules()]);

		const records = Object.values(maintenanceData?.body || {})
			.filter(r => r.equipmentId === item.id)
			.sort((a, b) => new Date(b.date) - new Date(a.date));

		const schedules = Object.values(scheduleData?.body || {}).filter(s => s.equipmentId === item.id);

		// Auto-flag needs_maintenance if any schedule is overdue and status is currently active/unset
		if (!['out_of_service', 'destroyed', 'needs_service', 'needs_maintenance'].includes(item.status)) {
			const today = new Date();
			const currentUsage = Number(item.usage) || 0;
			const anyOverdue = schedules.some(
				s => (scheduleStatus(s, currentUsage, item.usageUnit, today) ?? { status: 'ok' }).status === 'overdue',
			);

			if (anyOverdue) {
				await updateEquipment(item.id, { body: { status: 'needs_maintenance', _v: item._v } });
				this._rescaleEquipmentMarkers();
			}
		}

		renderMaintenanceSection(item, records, schedules, {
			refresh: () => this._renderEquipmentView(),
			appendTo: this._content,
		});
		await renderEntityRevenue('equipment', item, () => this._renderEquipmentView(), this._content);
		await renderLeasesToggle('equipment', item, () => this._renderEquipmentView(), this._content);
		await renderIncidents('equipment', item, () => this._renderEquipmentView(), this._content);
	}

	async _renderEquipmentEdit() {
		const { data: item, callbacks } = this._entity;

		this._titleElem.elem.textContent = 'Edit Equipment';
		this._configureButtons();
		this._metaElem.empty();
		this._content.empty();

		const getters = {};
		const SEL_STYLE = { ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' };

		// Emoji picker — same pattern as building and path edit
		const eqEmojiRow = new Component({
			appendTo: this._content,
			style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px' },
		});
		const eqEmojiInput = new Elem({ tag: 'input', appendTo: eqEmojiRow });

		Object.assign(eqEmojiInput.elem, {
			type: 'text',
			maxLength: 4,
			value: item.emoji || equipmentEmoji(item.type || ''),
		});
		eqEmojiInput.setStyle({
			...INPUT_STYLE,
			width: '52px',
			textAlign: 'center',
			fontSize: '22px',
			padding: '4px',
			flexShrink: '0',
		});
		eqEmojiInput.elem.title = 'Tap to change emoji';

		const eqEmojiHint = new Elem({ tag: 'span', appendTo: eqEmojiRow });

		eqEmojiHint.setStyle({ fontSize: '11px', color: 'rgba(255,255,255,0.3)' });
		eqEmojiHint.elem.textContent = item.emoji ? 'Custom · clear to auto-detect' : 'Auto-detected · tap to change';

		eqEmojiInput.elem.addEventListener('input', () => {
			eqEmojiInput.elem.dataset.manual = eqEmojiInput.elem.value ? '1' : '';
			eqEmojiHint.elem.textContent = eqEmojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		const addField = (key, label, { placeholder = '', type = 'text', options = null } = {}) => {
			new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: label });

			if (options) {
				const select = new Elem({ tag: 'select', appendTo: this._content });

				select.setStyle(SEL_STYLE);
				for (const { value, label: optionLabel } of options) {
					const opt = document.createElement('option');

					opt.value = value;
					opt.textContent = optionLabel;
					select.elem.append(opt);
				}
				select.elem.value = item[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Elem({ tag: 'input', appendTo: this._content });

				Object.assign(input.elem, { type, placeholder, value: item[key] || '' });
				Object.assign(input.elem.style, INPUT_STYLE);
				getters[key] = () => input.elem.value;
			}
		};

		addField('name', 'Name / ID', { placeholder: 'e.g. JD 8R 340' });

		// Type field — auto-updates emoji if not manually overridden
		new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: 'Type' });
		const typeInput = new Elem({ tag: 'input', appendTo: this._content });

		Object.assign(typeInput.elem, { type: 'text', placeholder: 'e.g. Row crop tractor', value: item.type || '' });
		Object.assign(typeInput.elem.style, INPUT_STYLE);
		typeInput.elem.addEventListener('input', () => {
			if (!eqEmojiInput.elem.dataset.manual) eqEmojiInput.elem.value = equipmentEmoji(typeInput.elem.value);
		});
		getters['type'] = () => typeInput.elem.value;
		addField('tenure', 'Ownership', {
			options: [
				{ value: 'own', label: 'Owned' },
				{ value: 'lease', label: 'Leased' },
			],
		});
		new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: 'Usage' });
		const usageRow = new Component({ appendTo: this._content, style: { display: 'flex', gap: '6px' } });
		const usageInput = new Elem({ tag: 'input', appendTo: usageRow, style: { ...INPUT_STYLE, flex: '1' } });
		Object.assign(usageInput.elem, { type: 'number', step: '0.1', placeholder: 'Amount', value: item.usage || '' });
		const unitInput = new Elem({
			tag: 'input',
			appendTo: usageRow,
			style: { ...INPUT_STYLE, width: '72px', flexShrink: '0' },
		});
		Object.assign(unitInput.elem, { type: 'text', placeholder: 'hrs', value: item.usageUnit || '' });
		getters['usage'] = () => usageInput.elem.value;
		getters['usageUnit'] = () => unitInput.elem.value;
		addField('size', 'Size', {
			options: [
				{ value: 'sm', label: 'Small' },
				{ value: 'med', label: 'Medium' },
				{ value: 'lrg', label: 'Large' },
				{ value: 'xlrg', label: 'X-Large' },
			],
		});
		addField('status', 'Status', {
			options: [
				{ value: '', label: '✓ Active' },
				{ value: 'needs_maintenance', label: '🔩 Needs maintenance' },
				{ value: 'needs_service', label: '🔧 Needs service' },
				{ value: 'out_of_service', label: '⚠️ Out of service' },
				{ value: 'destroyed', label: '☠️ Destroyed' },
			],
		});
		addField('appraisalValue', 'Appraised Value ($)', {
			type: 'number',
			placeholder: 'Market value — used in net worth',
		});

		const eqLabelCb = this._mkLabelToggle(item.showLabel !== false);

		getters['showLabel'] = () => eqLabelCb.checked;

		const { collect: collectEqProps } = makePropertiesEditor(this._content, item.properties || {});

		getters['properties'] = collectEqProps;

		const buttons = new Component({
			appendTo: this._content,
			style: { display: 'flex', gap: '8px', marginTop: '16px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			style: { flex: '1' },
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				// Use picker value; fall back to auto-detect if cleared
				const autoEmoji = equipmentEmoji(data.type);

				data.emoji = eqEmojiInput.elem.value && eqEmojiInput.elem.value !== autoEmoji ? eqEmojiInput.elem.value : '';
				const updated = await callbacks.onSave?.(data);
				if (updated) {
					this._entity.data = updated;
				}
				this._renderEquipmentView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			style: { flex: '1' },
			onPointerPress: () => this._renderEquipmentView(),
		});
	}

	async _renderViewMode() {
		const field = this._field;
		const callbacks = this._callbacks;

		this._titleElem.elem.textContent = field.name || 'Unnamed Field';

		this._configureButtons({ edit: true, editBoundary: !!field.geometry, del: true });

		this._editBtn.options.onPointerPress = () => this._renderEditMode();

		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditBoundary;

		this._deleteBtn.options.onPointerPress = async () => {
			if (await Dialog.confirm({ header: `Delete "${field.name || 'this field'}"?`, confirmLabel: 'Delete' }))
				callbacks.onDelete?.();
		};

		this._metaElem.empty();
		TenureBadge(field.tenure || 'rent', this._metaElem);

		if (field.acreage) {
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '13px', color: 'rgba(255,255,255,0.7)' },
				textContent: formatArea(field.acreage, field.acreageUnit || 'ac'),
			});
		}

		if (field.county || field.state) {
			new Elem({
				tag: 'span',
				appendTo: this._metaElem,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.45)' },
				textContent: [field.county, field.state].filter(Boolean).join(', '),
			});
		}

		this._content.empty();
		await this._renderDetails(field);
	}

	async _renderEditMode() {
		const field = this._field;

		this._titleElem.elem.textContent = 'Edit Field';
		this._configureButtons();

		this._metaElem.empty();
		this._content.empty();

		const inputGetters = {};

		for (const { key, label, placeholder, options, type } of EDIT_FIELDS) {
			new Elem({ tag: 'label', appendTo: this._content, style: LABEL_STYLE, textContent: label });

			if (options) {
				const select = new Elem({ tag: 'select', appendTo: this._content });

				select.setStyle({ ...INPUT_STYLE, cursor: 'pointer', appearance: 'auto', webkitAppearance: 'auto' });

				for (const { value, label: optLabel } of options) {
					const opt = document.createElement('option');

					opt.value = value;
					opt.textContent = optLabel;
					select.elem.append(opt);
				}

				select.elem.value = field[key] || options[0].value;
				inputGetters[key] = () => select.elem.value;
			} else if (key === 'acreage') {
				const wrap = new Elem({
					tag: 'div',
					appendTo: this._content,
					style: {
						display: 'flex',
						alignItems: 'center',
						background: 'rgba(255,255,255,0.07)',
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: '4px',
						overflow: 'hidden',
						marginTop: '4px',
					},
				});

				const currentUnit = field.acreageUnit || 'ac';
				const sqm = field.geometry ? geodesicAreaSqm(field.geometry) : null;
				const defaultAcreage = field[key] || (sqm ? convertArea(sqm, currentUnit) : '') || '';
				const unitMeta = AREA_UNITS.find(u => u.value === currentUnit) || AREA_UNITS[1];

				const input = new Elem({ tag: 'input', appendTo: wrap });

				Object.assign(input.elem, {
					type: 'number',
					step: '0.01',
					min: '0',
					placeholder: 'Size',
					value: defaultAcreage ? Number(defaultAcreage).toFixed(unitMeta.decimals) : '',
				});
				Object.assign(input.elem.style, {
					...INPUT_STYLE,
					border: 'none',
					background: 'transparent',
					flex: '1',
					marginTop: '0',
				});

				// Unit selector
				const unitSelect = new Elem({ tag: 'select', appendTo: wrap });

				unitSelect.setStyle({
					background: 'transparent',
					border: 'none',
					borderLeft: '1px solid rgba(255,255,255,0.12)',
					color: '#fff',
					cursor: 'pointer',
					fontSize: '13px',
					padding: '7px 4px',
					fontFamily: 'inherit',
					flexShrink: '0',
					outline: 'none',
					width: '54px',
				});

				for (const { value: unitValue, label } of AREA_UNITS) {
					const opt = document.createElement('option');

					opt.value = unitValue;
					opt.textContent = label;
					opt.style.background = '#1a1a1a';
					unitSelect.elem.append(opt);
				}

				unitSelect.elem.value = currentUnit;

				// Recalculate when unit changes
				unitSelect.elem.addEventListener('change', () => {
					if (!sqm) return;

					const newMeta = AREA_UNITS.find(u => u.value === unitSelect.elem.value) || AREA_UNITS[1];

					input.elem.value = convertArea(sqm, unitSelect.elem.value).toFixed(newMeta.decimals);
				});

				inputGetters[key] = () => input.elem.value;
				inputGetters['acreageUnit'] = () => unitSelect.elem.value;

				if (sqm) {
					new Button({
						appendTo: wrap,
						textContent: '↺',
						title: 'Calculate from boundary',
						style: {
							borderRadius: '0',
							borderLeft: '1px solid rgba(255,255,255,0.12)',
							padding: '7px 9px',
							fontSize: '13px',
							flexShrink: '0',
						},
						onPointerPress: () => {
							const meta = AREA_UNITS.find(u => u.value === unitSelect.elem.value) || AREA_UNITS[1];

							input.elem.value = convertArea(sqm, unitSelect.elem.value).toFixed(meta.decimals);
						},
					});
				}
			} else {
				const input = new Elem({ tag: 'input', appendTo: this._content });

				Object.assign(input.elem, {
					type: type || 'text',
					placeholder: placeholder || '',
					value: field[key] || '',
				});
				Object.assign(input.elem.style, INPUT_STYLE);
				inputGetters[key] = () => input.elem.value;
			}
		}

		const labelCb = this._mkLabelToggle(field.showLabel !== false);

		inputGetters['showLabel'] = () => labelCb.checked;

		const { collect: collectProps } = makePropertiesEditor(this._content, field.properties || {});

		inputGetters['properties'] = collectProps;

		const buttons = new Component({
			appendTo: this._content,
			style: { display: 'flex', gap: '8px', marginTop: '16px' },
		});

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			style: { flex: '1' },
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(inputGetters).map(([k, get]) => [k, get()]));
				const updated = await this._callbacks.onSave?.(data);

				if (updated) this._field = updated;
				await this._renderViewMode();
			},
		});

		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			style: { flex: '1' },
			onPointerPress: () => this._renderViewMode(),
		});
	}

	_renderProperties(properties, container) {
		if (!properties || typeof properties !== 'object') return;

		const entries = Object.entries(properties).filter(([, v]) => v !== '' && v != null);

		if (!entries.length) return;

		for (const [key, value] of entries) {
			const row = new DetailRow({ appendTo: container });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: key });
			new Elem({ tag: 'span', appendTo: row, addClass: 'value', textContent: String(value) });
		}
	}

	async _renderDetails(field) {
		// Weather strip renders async into a pre-created container — doesn't block events fetch
		const weatherContainer = new Component({ appendTo: this._content });

		renderWeatherStrip(field, weatherContainer);

		// Use events passed from MapView (already subscribed) to avoid a redundant fetch
		const eventsData = this._passedEvents ? null : await getEvents();
		const fieldEvents = (this._passedEvents || Object.values(eventsData?.body || {}))
			.filter(e => e.fieldId === field.id)
			.sort((a, b) => new Date(b.date) - new Date(a.date));

		// Group events by season year
		const byYear = new Map();

		for (const event of fieldEvents) {
			const yr = event.season || (event.date ? new Date(event.date).getFullYear() : null);

			if (!yr) continue;
			if (!byYear.has(yr)) byYear.set(yr, []);
			byYear.get(yr).push(event);
		}

		const sortedYears = [...byYear.keys()].sort((a, b) => b - a);
		const calYear = new Date().getFullYear();
		// Use actual calendar year if it has events; otherwise fall back to most recent year with data
		const currentYear = byYear.has(calYear) ? calYear : sortedYears[0] || calYear;
		const currentEvents = byYear.get(currentYear) || [];
		const pastYears = sortedYears.filter(y => y !== currentYear);

		// ── Current Use ─────────────────────────────────────────────────────────
		const useHeader = new Component({
			appendTo: this._content,
			style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
		});

		new SectionHeader({ appendTo: useHeader, textContent: `Current Use — ${currentYear}` });

		const useActions = new Component({
			appendTo: useHeader,
			style: { display: 'flex', gap: '6px', marginTop: '10px' },
		});

		new Button({
			appendTo: useActions,
			textContent: '+ Event',
			style: { fontSize: '11px', padding: '2px 8px' },
			onPointerPress: () =>
				new EventDialog({
					fieldId: field.id,
					onSave: async data => {
						await import('../api').then(({ createEvent }) => createEvent({ body: data }));
						this._renderViewMode();
					},
				}),
		});

		new Button({
			appendTo: useActions,
			textContent: 'All →',
			style: { fontSize: '11px', padding: '2px 6px' },
			onPointerPress: () => {
				context.timelineFieldFilter = field.id;
				window.location.hash = '/Timeline';
				this.hide();
			},
		});

		if (!currentEvents.length) {
			new Elem({
				tag: 'div',
				appendTo: this._content,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '5px 0 8px' },
				textContent: 'No activity this season',
			});
		} else {
			// Group by primary category — crop/livestock first, then others
			const catOrder = ['crop', 'livestock', 'harvest', 'cover_crop', 'input', 'tillage', 'soil_test', 'observation'];
			const byCat = new Map();

			for (const event of currentEvents) {
				if (!byCat.has(event.category)) byCat.set(event.category, []);
				byCat.get(event.category).push(event);
			}

			const orderedCats = [...byCat.keys()].sort((a, b) => {
				const ai = catOrder.indexOf(a),
					bi = catOrder.indexOf(b);
				return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
			});

			const renderEventBlock = (event, extraDetails = []) => {
				const d = parseDetails(event.details);
				const emoji = eventEmoji(event);
				const label = event.name || categoryMeta(event.category).label.replace(/^[^\s]+\s/, '');

				const block = new Component({
					appendTo: this._content,
					style: { padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' },
				});

				const titleRow = new Component({
					appendTo: block,
					style: { display: 'flex', alignItems: 'center', gap: '7px' },
				});

				new Elem({ tag: 'span', appendTo: titleRow, style: { fontSize: '15px' }, textContent: emoji });
				new Elem({
					tag: 'span',
					appendTo: titleRow,
					style: { fontSize: '14px', color: '#fff', fontWeight: '500', flex: '1' },
					textContent: label,
				});
				if (event.date)
					new Elem({
						tag: 'span',
						appendTo: titleRow,
						style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' },
						textContent: new Date(event.date).toLocaleDateString(),
					});

				const details = [...extraDetails];

				if (event.category === 'crop') {
					if (d.variety) details.push(d.variety);
					if (d.seedingRate) details.push(d.seedingRate);
				} else if (event.category === 'livestock') {
					if (d.entryWeight) details.push(`${d.entryWeight} lbs/hd entry`);
				} else if (event.category === 'harvest') {
					if (d.quantity && d.unit) details.push(`${d.quantity} ${d.unit}`);
					if (d.revenue) details.push(formatDollar(d.revenue));
				} else if (event.category === 'cover_crop') {
					if (Array.isArray(d.species) && d.species.length)
						details.push(
							d.species
								.map(s => s.name)
								.filter(Boolean)
								.join(' + '),
						);
					if (d.terminationMethod) details.push(`→ ${d.terminationMethod.replace(/_/g, ' ')}`);
				} else if (event.category === 'soil_test') {
					if (d.organicMatter) details.push(`OM ${d.organicMatter}%`);
					if (d.pH) details.push(`pH ${d.pH}`);
				} else if (event.category === 'tillage') {
					if (d.type) details.push(d.type.replace(/_/g, ' '));
				} else if (event.category === 'input') {
					if (d.product) details.push(d.product);
					if (d.rate) details.push(d.rate);
				}

				if (details.length) {
					new Elem({
						tag: 'div',
						appendTo: block,
						style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', paddingLeft: '22px', marginTop: '2px' },
						textContent: details.join(' · '),
					});
				}
			};

			for (const cat of orderedCats) {
				const yearEvents = byCat.get(cat);

				// Inputs and tillage: collapse to a count summary
				if (cat === 'input' || cat === 'tillage') {
					if (yearEvents.length > 1) {
						const first = yearEvents[0];
						const d = parseDetails(first.details);
						const block = new Component({
							appendTo: this._content,
							style: { padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' },
						});
						const titleRow = new Component({
							appendTo: block,
							style: { display: 'flex', alignItems: 'center', gap: '7px' },
						});

						new Elem({ tag: 'span', appendTo: titleRow, style: { fontSize: '15px' }, textContent: eventEmoji(first) });
						new Elem({
							tag: 'span',
							appendTo: titleRow,
							style: { fontSize: '14px', color: '#fff', fontWeight: '500', flex: '1' },
							textContent: `${yearEvents.length} ${cat === 'input' ? 'applications' : 'tillage passes'}`,
						});
						if (d.product || d.type)
							new Elem({
								tag: 'div',
								appendTo: block,
								style: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', paddingLeft: '22px', marginTop: '2px' },
								textContent: yearEvents
									.map(e => {
										const dd = parseDetails(e.details);
										return dd.product || dd.type || '';
									})
									.filter(Boolean)
									.join(', '),
							});
					} else {
						renderEventBlock(yearEvents[0]);
					}
				} else {
					// Each event gets its own row — livestock breeds, harvests, crops all individual
					for (const event of yearEvents) renderEventBlock(event);
				}
			}
		}

		// ── History snippet ──────────────────────────────────────────────────────
		if (pastYears.length) {
			new SectionHeader({ appendTo: this._content, textContent: 'History' });

			for (const yr of pastYears.slice(0, 5)) {
				const yearEvents = byYear.get(yr);
				const row = new Component({
					appendTo: this._content,
					style: {
						display: 'flex',
						alignItems: 'baseline',
						gap: '6px',
						padding: '4px 0',
						borderBottom: '1px solid rgba(255,255,255,0.06)',
						fontSize: '12px',
					},
				});

				new Elem({
					tag: 'span',
					appendTo: row,
					style: { color: 'rgba(255,255,255,0.4)', flexShrink: '0', width: '34px' },
					textContent: `${yr}`,
				});

				// Show emoji + name for each unique primary category
				const primaries = ['crop', 'livestock', 'harvest'];
				const tokens = [];

				const sortKey = cat => {
					const i = primaries.indexOf(cat);
					return i === -1 ? 99 : i;
				};

				for (const event of [...yearEvents].sort((a, b) => sortKey(a.category) - sortKey(b.category))) {
					if (tokens.length >= 4) break;
					const d = parseDetails(event.details);
					const em = eventEmoji(event);

					if (event.category === 'harvest' && d.quantity) tokens.push(`${em} ${d.quantity} ${d.unit || ''}`);
					else if (event.category === 'crop' && d.species) tokens.push(`${em} ${d.species}`);
					else if (event.category === 'livestock' && d.species)
						tokens.push(`${em} ${d.headCount ? d.headCount + ' hd' : d.species}`);
					else if (!primaries.includes(event.category)) tokens.push(em);
				}

				new Elem({
					tag: 'span',
					appendTo: row,
					style: { color: 'rgba(255,255,255,0.7)', flex: '1' },
					textContent: tokens.join('  ') || '—',
				});
			}
		}

		new SectionHeader({ appendTo: this._content, textContent: 'Field' });

		const fieldStatusLabel = field.status
			? FIELD_STATUSES.find(s => s.value === field.status)?.label || field.status
			: null;

		if (fieldStatusLabel) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: 'Status' });
			new Elem({ tag: 'span', appendTo: row, addClass: 'value', textContent: fieldStatusLabel });
		}

		this._renderProperties(field.properties, this._content);

		renderEconomics(field, fieldEvents, this._content);

		// Kick off all remaining fetches in parallel
		const livestockEvents = fieldEvents.filter(e => e.category === 'livestock');

		await Promise.all([
			livestockEvents.length
				? renderFeedingSection(field, livestockEvents, () => this._renderViewMode(), this._content)
				: Promise.resolve(),
			renderLeasesToggle('field', field, () => this._renderViewMode(), this._content),
			renderIncidents('field', field, () => this._renderViewMode(), this._content, { livestockEvents }),
		]);

		// Charts derived from Events — show when 2+ years of event data exist
		const fieldYears = new Set(
			fieldEvents.map(e => e.season || (e.date ? new Date(e.date).getFullYear() : null)).filter(Boolean),
		);

		if (fieldYears.size >= 2) {
			new SectionHeader({ appendTo: this._content, textContent: 'Trends' });
			new SeasonCharts({
				appendTo: this._content,
				events: fieldEvents,
				fields: { [field.id]: field },
				fieldFilter: field.id,
				allEvents: this._allEvents,
				allFields: this._allFields || {},
			});
		}

		// Precision data layers (yield maps, as-applied maps)
		renderPrecisionLayersSection(field, this._content, {
			onShowLayer: layer => this._callbacks?.onShowPrecisionLayer?.(layer),
			onRefresh: () => this._renderViewMode(),
		});
	}
}
