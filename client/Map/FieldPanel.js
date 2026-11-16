import {
	Button,
	Component,
	Dialog,
	Elem,
	formatDate,
	Link,
	parseDate,
	SectionLabel,
	styled,
	theme,
} from '@vanilla-bean/components';

import { formatArea } from '../geo';
import parseDetails from '../utils/parseDetails';
import { formatDollar } from '../utils/format';

import { getEvents, updateEvent, getMaintenance, getMaintenanceSchedules, updateEquipment } from '../api';
import { eventEmoji } from '../Timeline/EventDialog';
import { categoryMeta } from '../eventCategories';
import { ActionHeader, FieldPanel as StyledPanel, DetailRow, TenureBadge } from '../Layout';
import EventDialog from '../Timeline/EventDialog';
import SeasonCharts from '../Charts/SeasonCharts';
import { scheduleStatus } from '../utils/maintenanceUtils';
import { IconText, STATUS_ICONS } from '../statusIcons';
import { timelineHref } from '../routes';
import BuildingDialog, { buildingEmoji } from './BuildingDialog';
import EquipmentDialog, { equipmentEmoji } from './EquipmentDialog';
import FieldDialog from './FieldDialog';
import ParcelDialog from './ParcelDialog';
import PathDialog, { detectPathEmoji } from './PathDialog';
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
		color: ${colors.muted};
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
		color: ${colors.muted};
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
			color: ${colors.muted};
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
			color: ${colors.muted};
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
			color: ${colors.muted};
		}

		& .tokens {
			flex: 1;
			color: ${colors.muted};
		}
	`,
);

const FIELD_STATUSES = [
	{ value: '', label: 'Active' },
	{ value: 'needs_maintenance', label: 'Needs maintenance' },
	{ value: 'needs_service', label: 'Needs service' },
	{ value: 'out_of_service', label: 'Out of service' },
	{ value: 'fallow', label: 'Fallow' },
	{ value: 'abandoned', label: 'Abandoned' },
	{ value: 'destroyed', label: 'Destroyed' },
];

// On desktop the panel slides open beside the map
const FieldPanelOuter = styled(
	Component,
	({ media }) => `
		@media ${media.wide} {
			flex-shrink: 0;
			width: 0;
			overflow: hidden;
			transition: width 0.3s ease;

			&.open {
				width: 340px;
			}
		}
	`,
);

export default class FieldPanel extends FieldPanelOuter {
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

	build() {
		this._escHandler = e => {
			if (e.key === 'Escape' && this.panel?.hasClass('open')) this.hide();
		};

		document.addEventListener('keydown', this._escHandler);
		this.addCleanup('esc', () => document.removeEventListener('keydown', this._escHandler));

		this.addClass('field-panel-outer');

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
			intent: 'success',
		});
		this._deleteBtn = new Button({
			appendTo: this._actions,
			variant: 'flat',
			icon: 'trash',
			title: 'Delete field',
			intent: 'danger',
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
				size: 'small',
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

		this._editBtn.options.onPointerPress = () =>
			new PathDialog({
				path: p,
				onSave: data => this._saveEntity(data, () => this._renderPathView()),
				onDelete: callbacks.onDelete,
			});
		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditPath;

		this._deleteBtn.options.onPointerPress = async () => {
			if (
				await Dialog.confirm({ header: `Delete "${p.name || 'this path'}"?`, confirmLabel: 'Delete', intent: 'danger' })
			)
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

	// Saves an edit made in the record's dialog and shows the saved record; a failed save goes back to the dialog. The
	// save carries the version shown, so a second edit isn't taken for someone else's change to the one first opened.
	async _saveEntity(data, render) {
		const updated = await this._entity.callbacks.onSave?.({ ...data, _v: this._entity.data._v });

		if (updated?.status === 'error' || updated?.conflict) return updated;
		if (updated) this._entity.data = updated;
		render();
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

		this._editBtn.options.onPointerPress = () =>
			new ParcelDialog({
				parcel: p,
				onSave: data => this._saveEntity(data, () => this._renderParcelView()),
				onDelete: callbacks.onDelete,
			});
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
			if (await Dialog.confirm({ header: `Delete this property line?`, confirmLabel: 'Delete', intent: 'danger' }))
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

		this._editBtn.options.onPointerPress = () =>
			new BuildingDialog({
				building: b,
				onSave: data => this._saveEntity(data, () => this._renderBuildingView()),
				onDelete: callbacks.onDelete,
			});
		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditBoundary;

		this._deleteBtn.options.onPointerPress = async () => {
			if (
				await Dialog.confirm({
					header: `Delete "${b.name || 'this building'}"?`,
					confirmLabel: 'Delete',
					intent: 'danger',
				})
			)
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
			variant: 'flat',
			size: 'small',
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
			new Link({
				appendTo: actButtons,
				variant: 'flat',
				icon: 'calendar-days',
				tooltip: false,
				textContent: 'Open in Timeline',
				href: timelineHref(building.id),
				onPointerPress: () => this.hide(),
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

	async _renderEquipmentView() {
		const { data: item, callbacks } = this._entity;
		const emoji = equipmentEmoji(item.type, item.emoji);

		this._titleElem.elem.textContent = `${emoji} ${item.name || 'Equipment'}`;
		this._configureButtons({ edit: true, move: true, sell: true, del: true });

		this._editBtn.options.onPointerPress = () =>
			new EquipmentDialog({
				item,
				onSave: data => this._saveEntity(data, () => this._renderEquipmentView()),
				onDelete: callbacks.onDelete,
			});
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
			if (
				await Dialog.confirm({
					header: `Delete "${item.name || 'this equipment'}"?`,
					confirmLabel: 'Delete',
					intent: 'danger',
				})
			)
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

			// The map's equipment list is fetched again after the update, and redraws its markers itself.
			// A refused flag leaves the status as it stands: it's tried again the next time this opens
			if (anyOverdue) {
				const flagged = await updateEquipment(item.id, { body: { status: 'needs_maintenance', _v: item._v } });

				if (flagged.status === 'success') Object.assign(item, flagged.body);
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

	async _renderViewMode() {
		const field = this._field;
		const callbacks = this._callbacks;

		this._titleElem.elem.textContent = field.name || 'Unnamed Field';

		this._configureButtons({ edit: true, editBoundary: !!field.geometry, del: true });

		this._editBtn.options.onPointerPress = () =>
			new FieldDialog({
				field,
				onSave: async data => {
					const updated = await callbacks.onSave?.({ ...data, _v: this._field._v });

					if (updated?.status === 'error' || updated?.conflict) return updated;
					if (updated) this._field = updated;
					await this._renderViewMode();
				},
				onDelete: callbacks.onDelete,
			});

		this._editBoundaryBtn.options.onPointerPress = callbacks.onEditBoundary;

		this._deleteBtn.options.onPointerPress = async () => {
			if (
				await Dialog.confirm({
					header: `Delete "${field.name || 'this field'}"?`,
					confirmLabel: 'Delete',
					intent: 'danger',
				})
			)
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
			variant: 'flat',
			size: 'small',
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

		new Link({
			appendTo: useActions,
			variant: 'flat',
			icon: 'calendar-days',
			tooltip: false,
			textContent: 'Open in Timeline',
			href: timelineHref(field.id),
			onPointerPress: () => this.hide(),
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
