import {
	Button,
	Component,
	Dialog,
	Elem,
	formatDate,
	Input,
	parseDate,
	SectionLabel,
	Select,
	styled,
	theme,
} from '@vanilla-bean/components';
import { failureReason } from '@vanilla-bean/hypertether';

import { geodesicAreaSqm, convertArea, formatArea, AREA_UNITS } from '../geo';
import parseDetails from '../utils/parseDetails';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { formatDollar } from '../utils/format';

import { getEvents, updateEvent, getMaintenance, getMaintenanceSchedules, updateEquipment } from '../api';
import { eventEmoji } from '../Timeline/EventDialog';
import { categoryMeta } from '../eventCategories';
import { ActionHeader, FieldPanel as StyledPanel, DetailRow, FormLabel, TenureBadge } from '../Layout';
import context from '../context';
import EventDialog from '../Timeline/EventDialog';
import SeasonCharts from '../Charts/SeasonCharts';
import { scheduleStatus } from '../utils/maintenanceUtils';
import { IconText, STATUS_ICONS } from '../statusIcons';
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

const { colors, space } = theme;

// At 16px a phone's browser doesn't zoom the page in when the field takes focus
const FIELD_STYLE = { fontSize: '16px' };

const PanelHeader = styled(
	Component,
	({ space }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: ${space.sm};
	`,
);

const PanelTitle = styled(
	Component,
	({ space }) => `
		flex: 1;
		min-width: 0;
		margin-right: ${space.sm};
		overflow: hidden;
		font-size: 18px;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	{ tag: 'span' },
);

const Presence = styled(
	Component,
	({ colors, radius, space }) => `
		display: none;
		flex-shrink: 0;
		align-items: center;
		margin-right: ${space.sm};
		padding: 1px ${space.sm};
		border: 1px solid ${colors.alpha(colors.warning, 0.35)};
		border-radius: ${radius.pill};
		background: ${colors.alpha(colors.warning, 0.15)};
		color: ${colors.light(colors.warning)};
		font-size: 10px;
		font-weight: 600;
		white-space: nowrap;
	`,
	{ tag: 'span' },
);

const StaleBanner = styled(
	Component,
	({ colors, radius, space }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: ${space.sm};
		margin-bottom: ${space.sm};
		padding: ${space.sm} ${space.md};
		border: 1px solid ${colors.alpha(colors.warning, 0.4)};
		border-radius: ${radius.sm};
		background: ${colors.alpha(colors.warning, 0.15)};
		color: ${colors.light(colors.warning)};
		font-size: 12px;

		& > button {
			flex-shrink: 0;
		}
	`,
);

// Secondary facts beside the badge under the title
const Meta = styled(
	Component,
	({ colors }) => `
		font-size: 13px;
		color: ${colors.muted};
	`,
	{ tag: 'span' },
);

const MetaFaint = styled(
	Component,
	({ colors }) => `
		font-size: 12px;
		color: ${colors.gray};
	`,
	{ tag: 'span' },
);

const OwnershipPill = styled(
	Component,
	({ colors, radius, space }) => `
		padding: ${space.xs} ${space.sm};
		border-radius: ${radius.sm};
		font-size: 12px;
		background: ${colors.alpha(colors.orange, 0.15)};
		color: ${colors.light(colors.orange)};

		&.own {
			background: ${colors.alpha(colors.info, 0.15)};
			color: ${colors.light(colors.info)};
		}
	`,
	{ tag: 'span' },
);

const SectionActions = styled(
	Component,
	({ space }) => `
		display: flex;
		gap: ${space.sm};
		margin-top: ${space.md};
	`,
);

const EmptyNote = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.sm} 0 ${space.sm};
		font-size: 12px;
		color: ${colors.gray};
	`,
);

const ActivityRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: flex-start;
		gap: ${space.sm};
		padding: ${space.xs} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;
		cursor: pointer;

		& .glyph {
			flex-shrink: 0;
			font-size: 14px;
		}

		& .info {
			flex: 1;
			min-width: 0;
		}

		& .name {
			color: ${colors.white};
		}

		& .meta {
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

// One event of this season: its category glyph, name and date, then a line of its details
const EventBlock = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};

		& .title {
			display: flex;
			align-items: center;
			gap: ${space.sm};
		}

		& .glyph {
			font-size: 15px;
		}

		& .name {
			flex: 1;
			min-width: 0;
			font-size: 14px;
			font-weight: 500;
			color: ${colors.white};
		}

		& .date {
			font-size: 11px;
			color: ${colors.gray};
		}

		& .details {
			margin-top: ${space.xs};
			padding-left: ${space.xl};
			font-size: 11px;
			color: ${colors.muted};
		}
	`,
);

const HistoryRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: baseline;
		gap: ${space.sm};
		padding: ${space.xs} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 12px;

		& .year {
			flex-shrink: 0;
			width: 34px;
			color: ${colors.gray};
		}

		& .tokens {
			flex: 1;
			color: ${colors.muted};
		}
	`,
);

const EmojiRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		margin: ${space.xs} 0 ${space.sm};

		& > input {
			flex-shrink: 0;
			width: 52px;
			padding: ${space.xs};
			font-size: 22px;
			text-align: center;
		}

		& > span {
			font-size: 11px;
			color: ${colors.gray};
		}
	`,
);

// A number with its unit beside it, drawn as one field
const AreaField = styled(
	Component,
	({ colors, radius, space }) => `
		display: flex;
		align-items: center;
		overflow: hidden;
		border: 1px solid ${colors.alpha(colors.white, 0.15)};
		border-radius: ${radius.sm};
		background: ${colors.alpha(colors.white, 0.06)};

		&:focus-within {
			border-color: ${colors.light(colors.blue)};
			box-shadow: 0 0 0 2px ${colors.alpha(colors.blue, 0.35)};
		}

		& > input,
		& > input:focus {
			flex: 1;
			min-width: 0;
			border: none;
			background: transparent;
			box-shadow: none;
		}

		& > select,
		& > select:focus {
			flex-shrink: 0;
			width: 54px;
			padding: ${space.sm} ${space.xs};
			border: none;
			border-left: 1px solid ${colors.border};
			border-radius: 0;
			background: transparent;
			box-shadow: none;
			font-size: 13px;
			cursor: pointer;
		}

		& > button {
			flex-shrink: 0;
			border-left: 1px solid ${colors.border};
			border-radius: 0;
		}
	`,
);

const LabelToggle = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		margin-top: ${space.md};

		& label {
			font-size: 13px;
			color: ${colors.muted};
			cursor: pointer;
			user-select: none;
		}
	`,
);

const FormButtons = styled(
	Component,
	({ space }) => `
		display: flex;
		gap: ${space.sm};
		margin-top: ${space.lg};

		& > button {
			flex: 1;
		}
	`,
);

const SaveFailure = styled(
	Elem,
	({ colors, space }) => `
		margin-top: ${space.md};
		color: ${colors.light(colors.danger)};
	`,
);

// The panel's edit forms save outside a FormDialog, so one shows a failed save's reason above its buttons as a FormDialog would
const failedSave = (result, buttons) => {
	if (result?.status !== 'error') return false;

	buttons.failure ??= new SaveFailure({ attributes: { role: 'alert' } });
	buttons.elem.before(buttons.failure.elem);
	buttons.failure.elem.textContent = failureReason(result);

	return true;
};

const FIELD_STATUSES = [
	{ value: '', label: 'Active' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'needs_service', label: 'Needs service' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'fallow', label: 'Fallow' },
	{ value: 'abandoned', label: 'Abandoned' },
	{ value: 'destroyed', label: 'Destroyed' },
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
		const row = new LabelToggle({ appendTo: this._content });
		const cb = new Input({ appendTo: row, attributes: { id: uniqueId } });

		cb.elem.type = 'checkbox';
		cb.elem.checked = defaultOn;

		const label = new Elem({ tag: 'label', appendTo: row, textContent: 'Show name label on map' });

		label.elem.htmlFor = uniqueId;

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
				@media ${theme.media.wide} {
					.field-panel-outer { flex-shrink: 0; width: 0; overflow: hidden; transition: width 0.3s ease; }
					.field-panel-outer.open { width: 340px; }
				}
			`;
			document.head.append(s);
		}

		this.panel = new StyledPanel({ appendTo: this });

		this._initDragToClose();

		const header = new PanelHeader({ appendTo: this.panel });

		this._titleElem = new PanelTitle({ appendTo: header });
		this._presenceIndicator = new Presence({ appendTo: header });

		this._actions = new Component({ appendTo: header, style: { display: 'flex', gap: space.sm, flexShrink: '0' } });

		this._editBtn = new Button({ appendTo: this._actions, variant: 'flat', icon: 'pen', title: 'Edit details' });
		this._editBoundaryBtn = new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'draw-polygon',
			title: 'Edit boundary',
		});
		this._moveBtn = new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'location-crosshairs',
			title: 'Move to new position',
		});
		this._sellBtn = new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'tag',
			title: 'Record sale of this asset',
			style: { color: colors.light(colors.success) },
		});
		this._deleteBtn = new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'trash',
			title: 'Delete field',
			style: { color: colors.light(colors.danger) },
		});
		new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'xmark',
			title: 'Close',
			onPointerPress: () => this.hide(),
		});

		this._configureButtons();

		this._metaElem = new Component({
			appendTo: this.panel,
			style: { display: 'flex', gap: space.sm, marginBottom: space.sm, flexWrap: 'wrap', alignItems: 'center' },
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

			this._staleBanner = new StaleBanner();

			new Elem({ tag: 'span', appendTo: this._staleBanner, textContent: 'This record was updated on another device.' });

			new Button({
				appendTo: this._staleBanner,
				variant: 'chip',
				textContent: 'Refresh',
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
			new Meta({
				appendTo: this._metaElem,
				textContent: p.type,
			});
		if (p.widthFt)
			new MetaFaint({
				appendTo: this._metaElem,
				textContent: `${p.widthFt} ft wide`,
			});

		this._content.empty();

		new SectionLabel({ appendTo: this._content, textContent: 'Path / Road' });

		const PATH_STATUS_LABELS = {
			needs_maintenance: 'Needs maintenance',
			needs_service: 'Needs service',
			out_of_service: 'Out of service',
			closed: 'Closed',
			destroyed: 'Destroyed',
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
				new IconText({
					tag: 'span',
					appendTo: row,
					addClass: 'value',
					icon: label === 'Status' ? STATUS_ICONS[p.status] : undefined,
					textContent: value,
				});
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
		const emojiRow = new EmojiRow({ appendTo: this._content });
		const emojiInput = new Input({ appendTo: emojiRow });

		Object.assign(emojiInput.elem, { type: 'text', maxLength: 4, value: p.emoji || detectPathEmoji(p.type || '') });
		emojiInput.elem.title = 'Tap to change emoji';

		const emojiHint = new Elem({ tag: 'span', appendTo: emojiRow });

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
			new FormLabel({ appendTo: this._content, textContent: label });
			const input = new Input({ appendTo: this._content });
			Object.assign(input.elem, { type: type || 'text', placeholder: placeholder || '', value: p[key] || '' });
			input.setStyle(FIELD_STYLE);
			getters[key] = () => input.elem.value;
			// Auto-update emoji when type changes
			if (key === 'type')
				input.elem.addEventListener('input', () => {
					if (!emojiInput.elem.dataset.manual) emojiInput.elem.value = detectPathEmoji(input.elem.value);
				});
		}

		// Color picker
		new FormLabel({ appendTo: this._content, textContent: 'Surface / Color' });

		let selectedColor = p.color || PATH_COLORS[0].value;
		const colorGrid = new Component({
			appendTo: this._content,
			style: {
				display: 'grid',
				gridTemplateColumns: 'repeat(4, 1fr)',
				gap: space.xs,
				marginTop: space.xs,
				marginBottom: space.sm,
			},
		});

		// The swatches are the path's own stored hex colors; the selected one is tinted with an alpha suffix
		const tint = value => `${value}44`;

		for (const { value, label } of PATH_COLORS) {
			const btn = new Button({
				appendTo: colorGrid,
				textContent: label,
				style: {
					background: value === selectedColor ? tint(value) : 'transparent',
					border: `2px solid ${value}`,
					color: colors.white,
					fontSize: '11px',
					padding: `${space.sm} ${space.xs}`,
				},
				onPointerPress: () => {
					selectedColor = value;
					Array.from(colorGrid.elem.children).forEach(b => {
						b.style.background = 'transparent';
					});
					btn.elem.style.background = tint(value);
				},
			});
			btn.elem.type = 'button';
		}

		new FormLabel({ appendTo: this._content, textContent: 'Status' });
		const pathStatusSelect = new Select({ appendTo: this._content });

		pathStatusSelect.setStyle(FIELD_STYLE);
		[
			{ value: '', label: 'Active' },
			{ value: 'needs_maintenance', label: 'Needs maintenance' },
			{ value: 'needs_service', label: 'Needs service' },
			{ value: 'out_of_service', label: 'Out of service' },
			{ value: 'closed', label: 'Closed' },
			{ value: 'destroyed', label: 'Destroyed' },
		].forEach(({ value, label }) => {
			const o = document.createElement('option');
			o.value = value;
			o.textContent = label;
			pathStatusSelect.elem.append(o);
		});
		pathStatusSelect.elem.value = p.status || '';

		const pathLabelCb = this._mkLabelToggle(p.showLabel === true);

		const { collect: collectPathProps } = makePropertiesEditor(this._content, p.properties || {});

		const buttons = new FormButtons({ appendTo: this._content });

		new Button({
			appendTo: buttons,
			textContent: 'Save',
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

				if (failedSave(updated, buttons)) return;
				if (updated) this._entity.data = updated;
				this._renderPathView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
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

		this._titleElem.elem.textContent = p.name || p.parcelId || 'Property Line';
		new IconText({ prependTo: this._titleElem, icon: 'ruler-combined', style: { display: 'inline-block' } });
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
			new Meta({
				appendTo: this._metaElem,
				textContent: formatArea(p.acreage, p.acreageUnit || 'ac'),
			});

		this._content.empty();

		new SectionLabel({ appendTo: this._content, textContent: 'Property Line' });

		const PARCEL_STATUS_LABELS = {
			needs_maintenance: 'Needs maintenance',
			out_of_service: 'Out of service',
			disputed: 'Disputed',
			encumbered: 'Encumbered',
			destroyed: 'Destroyed',
		};
		if (p.status) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: 'Status' });
			new IconText({
				tag: 'span',
				appendTo: row,
				addClass: 'value',
				icon: STATUS_ICONS[p.status],
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
					{ value: '', label: 'Active' },
					{ value: 'needs_maintenance', label: 'Needs maintenance' },
					{ value: 'out_of_service', label: 'Out of service' },
					{ value: 'disputed', label: 'Disputed' },
					{ value: 'encumbered', label: 'Encumbered' },
					{ value: 'destroyed', label: 'Destroyed' },
				],
			},
		]) {
			new FormLabel({ appendTo: this._content, textContent: label });

			if (options) {
				const select = new Select({ appendTo: this._content });

				select.setStyle(FIELD_STYLE);
				options.forEach(({ value, label: optionLabel }) => {
					const o = document.createElement('option');
					o.value = value;
					o.textContent = optionLabel;
					select.elem.append(o);
				});
				select.elem.value = p[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Input({ appendTo: this._content });

				Object.assign(input.elem, { type: 'text', placeholder: placeholder || '', value: p[key] || '' });
				input.setStyle(FIELD_STYLE);
				getters[key] = () => input.elem.value;
			}
		}

		// Area row — same pattern as field inline edit
		new FormLabel({ appendTo: this._content, textContent: 'Area' });

		const areaRow = new AreaField({ appendTo: this._content });

		const currentUnit = p.acreageUnit || 'ac';
		const sqm = p.geometry ? geodesicAreaSqm(p.geometry) : null;
		const defaultArea = p.acreage || (sqm ? convertArea(sqm, currentUnit) : '') || '';
		const unitMeta = AREA_UNITS.find(u => u.value === currentUnit) || AREA_UNITS[1];

		const areaInput = new Input({ appendTo: areaRow });

		Object.assign(areaInput.elem, {
			type: 'number',
			step: '0.01',
			min: '0',
			placeholder: 'Size',
			value: defaultArea ? Number(defaultArea).toFixed(unitMeta.decimals) : '',
		});
		areaInput.setStyle(FIELD_STYLE);

		const unitSelect = new Select({ appendTo: areaRow });

		for (const { value: unitValue, label } of AREA_UNITS) {
			const opt = document.createElement('option');
			opt.value = unitValue;
			opt.textContent = label;
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
				variant: 'flat',
				icon: 'arrows-rotate',
				title: 'Calculate from boundary',
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

		const buttons = new FormButtons({ appendTo: this._content });

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				const updated = await callbacks.onSave?.(data);

				if (failedSave(updated, buttons)) return;
				if (updated) this._entity.data = updated;
				this._renderParcelView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
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
			new Meta({
				appendTo: this._metaElem,
				textContent: b.type,
			});

		this._content.empty();

		new SectionLabel({ appendTo: this._content, textContent: 'Building' });

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

		const header = new ActionHeader({ appendTo: this._content, title: 'Activity' });
		const actButtons = new SectionActions({ appendTo: header });

		new Button({
			appendTo: actButtons,
			variant: 'chip',
			icon: 'plus',
			textContent: 'Event',
			onPointerPress: () =>
				new EventDialog({
					fieldId: building.id,
					onSave: async data => {
						const result = await import('../api').then(({ createEvent }) => createEvent({ body: data }));

						if (result?.status === 'success') this._renderBuildingView();

						return result;
					},
				}),
		});

		if (events.length) {
			new Button({
				appendTo: actButtons,
				variant: 'chip',
				icon: 'calendar-days',
				textContent: 'All',
				title: 'Open in Timeline',
				onPointerPress: () => {
					context.timelineFieldFilter = building.id;
					window.location.hash = '/Timeline';
					this.hide();
				},
			});
		}

		if (!events.length) {
			new EmptyNote({
				appendTo: this._content,
				textContent: 'No activity recorded',
			});
			return;
		}

		for (const event of events.slice(0, 8)) {
			const d = parseDetails(event.details);
			const emoji = eventEmoji(event);
			const meta = categoryMeta(event.category);

			const row = new ActivityRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'glyph', textContent: emoji });

			const info = new Component({ appendTo: row, addClass: 'info' });

			new Elem({
				tag: 'div',
				appendTo: info,
				addClass: 'name',
				textContent: event.name || meta?.label || event.category,
			});

			const eventMeta = [
				event.date ? formatDate(event.date) : null,
				d.species || null,
				d.headCount ? `${d.headCount} hd` : null,
				d.quantity ? `${d.quantity} ${d.unit || ''}`.trim() : null,
			].filter(Boolean);

			if (eventMeta.length)
				new Elem({
					tag: 'div',
					appendTo: info,
					addClass: 'meta',
					textContent: eventMeta.join(' · '),
				});

			row.onPointerPress(
				() =>
					new EventDialog({
						event: event,
						onSave: async data => {
							const result = await updateEvent(event.id, { body: { ...data, _v: event._v } });

							if (result?.status === 'success') this._renderBuildingView();

							return result;
						},
						onDelete: async () => {
							const result = await import('../api').then(({ deleteEvent }) => deleteEvent(event.id));

							if (result?.status === 'success') this._renderBuildingView();

							return result;
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
		const bldgEmojiRow = new EmojiRow({ appendTo: this._content });
		const bldgEmojiInput = new Input({ appendTo: bldgEmojiRow });

		Object.assign(bldgEmojiInput.elem, { type: 'text', maxLength: 4, value: b.emoji || buildingEmoji(b.type || '') });
		bldgEmojiInput.elem.title = 'Tap to change emoji';

		const bldgEmojiHint = new Elem({ tag: 'span', appendTo: bldgEmojiRow });

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
					{ value: '', label: 'Active' },
					{ value: 'needs_maintenance', label: 'Needs maintenance' },
					{ value: 'needs_service', label: 'Needs service' },
					{ value: 'out_of_service', label: 'Out of service' },
					{ value: 'destroyed', label: 'Destroyed' },
				],
			},
		]) {
			new FormLabel({ appendTo: this._content, textContent: label });

			if (options) {
				const select = new Select({ appendTo: this._content });

				select.setStyle(FIELD_STYLE);
				options.forEach(({ value, label: optionLabel }) => {
					const o = document.createElement('option');
					o.value = value;
					o.textContent = optionLabel;
					select.elem.append(o);
				});
				select.elem.value = b[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Input({ appendTo: this._content });

				Object.assign(input.elem, { type: 'text', placeholder: placeholder || '', value: b[key] || '' });
				input.setStyle(FIELD_STYLE);
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

		const buttons = new FormButtons({ appendTo: this._content });

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				const updated = await callbacks.onSave?.(data);

				if (failedSave(updated, buttons)) return;
				if (updated) {
					this._entity.data = updated;
				}
				this._renderBuildingView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
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
			new OwnershipPill({
				appendTo: this._metaElem,
				addClass: item.tenure === 'own' ? 'own' : 'lease',
				textContent: item.tenure === 'own' ? 'Owned' : 'Leased',
			});
		}
		if (item.type)
			new Meta({
				appendTo: this._metaElem,
				textContent: item.type,
			});

		this._content.empty();

		new SectionLabel({ appendTo: this._content, textContent: 'Equipment' });

		const formatCoordinate = n => (n != null ? Number(n).toFixed(5) : null);
		const lat = formatCoordinate(item.lat);
		const lng = formatCoordinate(item.lng);

		const STATUS_LABELS = {
			needs_maintenance: 'Needs maintenance',
			needs_service: 'Needs service',
			out_of_service: 'Out of service',
			destroyed: 'Destroyed',
		};
		const STATUS_COLORS = {
			needs_maintenance: colors.light(colors.orange),
			needs_service: colors.light(colors.warning),
			out_of_service: colors.muted,
			destroyed: colors.light(colors.danger),
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
			new IconText({
				tag: 'span',
				appendTo: row,
				addClass: 'value',
				style: color ? { color } : {},
				icon: label === 'Status' ? STATUS_ICONS[item.status] : undefined,
				textContent: value,
			});
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

		// Emoji picker — same pattern as building and path edit
		const eqEmojiRow = new EmojiRow({ appendTo: this._content });
		const eqEmojiInput = new Input({ appendTo: eqEmojiRow });

		Object.assign(eqEmojiInput.elem, {
			type: 'text',
			maxLength: 4,
			value: item.emoji || equipmentEmoji(item.type || ''),
		});
		eqEmojiInput.elem.title = 'Tap to change emoji';

		const eqEmojiHint = new Elem({ tag: 'span', appendTo: eqEmojiRow });

		eqEmojiHint.elem.textContent = item.emoji ? 'Custom · clear to auto-detect' : 'Auto-detected · tap to change';

		eqEmojiInput.elem.addEventListener('input', () => {
			eqEmojiInput.elem.dataset.manual = eqEmojiInput.elem.value ? '1' : '';
			eqEmojiHint.elem.textContent = eqEmojiInput.elem.value
				? 'Custom · clear to auto-detect'
				: 'Auto-detected · tap to change';
		});

		const addField = (key, label, { placeholder = '', type = 'text', options = null } = {}) => {
			new FormLabel({ appendTo: this._content, textContent: label });

			if (options) {
				const select = new Select({ appendTo: this._content });

				select.setStyle(FIELD_STYLE);
				for (const { value, label: optionLabel } of options) {
					const opt = document.createElement('option');

					opt.value = value;
					opt.textContent = optionLabel;
					select.elem.append(opt);
				}
				select.elem.value = item[key] || '';
				getters[key] = () => select.elem.value;
			} else {
				const input = new Input({ appendTo: this._content });

				Object.assign(input.elem, { type, placeholder, value: item[key] || '' });
				input.setStyle(FIELD_STYLE);
				getters[key] = () => input.elem.value;
			}
		};

		addField('name', 'Name / ID', { placeholder: 'e.g. JD 8R 340' });

		// Type field — auto-updates emoji if not manually overridden
		new FormLabel({ appendTo: this._content, textContent: 'Type' });
		const typeInput = new Input({ appendTo: this._content });

		Object.assign(typeInput.elem, { type: 'text', placeholder: 'e.g. Row crop tractor', value: item.type || '' });
		typeInput.setStyle(FIELD_STYLE);
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
		new FormLabel({ appendTo: this._content, textContent: 'Usage' });
		const usageRow = new Component({ appendTo: this._content, style: { display: 'flex', gap: space.sm } });
		const usageInput = new Input({
			appendTo: usageRow,
			style: { ...FIELD_STYLE, flex: '1', minWidth: '0' },
		});
		Object.assign(usageInput.elem, { type: 'number', step: '0.1', placeholder: 'Amount', value: item.usage || '' });
		const unitInput = new Input({
			appendTo: usageRow,
			style: { ...FIELD_STYLE, width: '72px', flexShrink: '0' },
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
				{ value: '', label: 'Active' },
				{ value: 'needs_maintenance', label: 'Needs maintenance' },
				{ value: 'needs_service', label: 'Needs service' },
				{ value: 'out_of_service', label: 'Out of service' },
				{ value: 'destroyed', label: 'Destroyed' },
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

		const buttons = new FormButtons({ appendTo: this._content });

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
				// Use picker value; fall back to auto-detect if cleared
				const autoEmoji = equipmentEmoji(data.type);

				data.emoji = eqEmojiInput.elem.value && eqEmojiInput.elem.value !== autoEmoji ? eqEmojiInput.elem.value : '';
				const updated = await callbacks.onSave?.(data);

				if (failedSave(updated, buttons)) return;
				if (updated) {
					this._entity.data = updated;
				}
				this._renderEquipmentView();
			},
		});
		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
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
			new Meta({
				appendTo: this._metaElem,
				textContent: formatArea(field.acreage, field.acreageUnit || 'ac'),
			});
		}

		if (field.county || field.state) {
			new MetaFaint({
				appendTo: this._metaElem,
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
			new FormLabel({ appendTo: this._content, textContent: label });

			if (options) {
				const select = new Select({ appendTo: this._content });

				select.setStyle(FIELD_STYLE);

				for (const { value, label: optLabel } of options) {
					const opt = document.createElement('option');

					opt.value = value;
					opt.textContent = optLabel;
					select.elem.append(opt);
				}

				select.elem.value = field[key] || options[0].value;
				inputGetters[key] = () => select.elem.value;
			} else if (key === 'acreage') {
				const wrap = new AreaField({ appendTo: this._content });

				const currentUnit = field.acreageUnit || 'ac';
				const sqm = field.geometry ? geodesicAreaSqm(field.geometry) : null;
				const defaultAcreage = field[key] || (sqm ? convertArea(sqm, currentUnit) : '') || '';
				const unitMeta = AREA_UNITS.find(u => u.value === currentUnit) || AREA_UNITS[1];

				const input = new Input({ appendTo: wrap });

				Object.assign(input.elem, {
					type: 'number',
					step: '0.01',
					min: '0',
					placeholder: 'Size',
					value: defaultAcreage ? Number(defaultAcreage).toFixed(unitMeta.decimals) : '',
				});
				input.setStyle(FIELD_STYLE);

				// Unit selector
				const unitSelect = new Select({ appendTo: wrap });

				for (const { value: unitValue, label } of AREA_UNITS) {
					const opt = document.createElement('option');

					opt.value = unitValue;
					opt.textContent = label;
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
						variant: 'flat',
						icon: 'arrows-rotate',
						title: 'Calculate from boundary',
						onPointerPress: () => {
							const meta = AREA_UNITS.find(u => u.value === unitSelect.elem.value) || AREA_UNITS[1];

							input.elem.value = convertArea(sqm, unitSelect.elem.value).toFixed(meta.decimals);
						},
					});
				}
			} else {
				const input = new Input({ appendTo: this._content });

				Object.assign(input.elem, {
					type: type || 'text',
					placeholder: placeholder || '',
					value: field[key] || '',
				});
				input.setStyle(FIELD_STYLE);
				inputGetters[key] = () => input.elem.value;
			}
		}

		const labelCb = this._mkLabelToggle(field.showLabel !== false);

		inputGetters['showLabel'] = () => labelCb.checked;

		const { collect: collectProps } = makePropertiesEditor(this._content, field.properties || {});

		inputGetters['properties'] = collectProps;

		const buttons = new FormButtons({ appendTo: this._content });

		new Button({
			appendTo: buttons,
			textContent: 'Save',
			onPointerPress: async () => {
				const data = Object.fromEntries(Object.entries(inputGetters).map(([k, get]) => [k, get()]));
				const updated = await this._callbacks.onSave?.(data);

				if (failedSave(updated, buttons)) return;
				if (updated) this._field = updated;
				await this._renderViewMode();
			},
		});

		new Button({
			appendTo: buttons,
			textContent: 'Cancel',
			variant: 'flat',
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
			const yr = event.season || (event.date ? parseDate(event.date).getFullYear() : null);

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
		const useHeader = new ActionHeader({ appendTo: this._content, title: `Current Use — ${currentYear}` });
		const useActions = new SectionActions({ appendTo: useHeader });

		new Button({
			appendTo: useActions,
			variant: 'chip',
			icon: 'plus',
			textContent: 'Event',
			onPointerPress: () =>
				new EventDialog({
					fieldId: field.id,
					onSave: async data => {
						const result = await import('../api').then(({ createEvent }) => createEvent({ body: data }));

						if (result?.status === 'success') this._renderViewMode();

						return result;
					},
				}),
		});

		new Button({
			appendTo: useActions,
			variant: 'chip',
			icon: 'calendar-days',
			textContent: 'All',
			title: 'Open in Timeline',
			onPointerPress: () => {
				context.timelineFieldFilter = field.id;
				window.location.hash = '/Timeline';
				this.hide();
			},
		});

		if (!currentEvents.length) {
			new EmptyNote({
				appendTo: this._content,
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
				const label = event.name || categoryMeta(event.category).name;

				const block = new EventBlock({ appendTo: this._content });

				const titleRow = new Component({ appendTo: block, addClass: 'title' });

				new Elem({ tag: 'span', appendTo: titleRow, addClass: 'glyph', textContent: emoji });
				new Elem({
					tag: 'span',
					appendTo: titleRow,
					addClass: 'name',
					textContent: label,
				});
				if (event.date)
					new Elem({
						tag: 'span',
						appendTo: titleRow,
						addClass: 'date',
						textContent: formatDate(event.date),
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
						addClass: 'details',
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
						const block = new EventBlock({ appendTo: this._content });
						const titleRow = new Component({ appendTo: block, addClass: 'title' });

						new Elem({ tag: 'span', appendTo: titleRow, addClass: 'glyph', textContent: eventEmoji(first) });
						new Elem({
							tag: 'span',
							appendTo: titleRow,
							addClass: 'name',
							textContent: `${yearEvents.length} ${cat === 'input' ? 'applications' : 'tillage passes'}`,
						});
						if (d.product || d.type)
							new Elem({
								tag: 'div',
								appendTo: block,
								addClass: 'details',
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
			new SectionLabel({ appendTo: this._content, textContent: 'History' });

			for (const yr of pastYears.slice(0, 5)) {
				const yearEvents = byYear.get(yr);
				const row = new HistoryRow({ appendTo: this._content });

				new Elem({ tag: 'span', appendTo: row, addClass: 'year', textContent: `${yr}` });

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
					addClass: 'tokens',
					textContent: tokens.join('  ') || '—',
				});
			}
		}

		new SectionLabel({ appendTo: this._content, textContent: 'Field' });

		const fieldStatusLabel = field.status
			? FIELD_STATUSES.find(s => s.value === field.status)?.label || field.status
			: null;

		if (fieldStatusLabel) {
			const row = new DetailRow({ appendTo: this._content });

			new Elem({ tag: 'span', appendTo: row, addClass: 'label', textContent: 'Status' });
			new IconText({
				tag: 'span',
				appendTo: row,
				addClass: 'value',
				icon: STATUS_ICONS[field.status],
				textContent: fieldStatusLabel,
			});
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
			fieldEvents.map(e => e.season || (e.date ? parseDate(e.date).getFullYear() : null)).filter(Boolean),
		);

		if (fieldYears.size >= 2) {
			new SectionLabel({ appendTo: this._content, textContent: 'Trends' });
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
