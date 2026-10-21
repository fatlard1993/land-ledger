import {
	Button,
	Card,
	Component,
	Elem,
	EmptyState,
	Icon,
	SectionLabel,
	styled,
	theme,
	Toolbar,
} from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getFields, getLeases, getEvents, createField, updateField, deleteField } from '../api';
import context from '../context';
import { toSqm, convertArea, formatArea } from '../geo';
import parseDetails from '../utils/parseDetails';
import { eventEmoji, categoryMeta } from '../Timeline/EventDialog';
import { PageView, RecordCard } from '../Layout';
import SeasonCharts from '../Charts/SeasonCharts';

import ExportDialog from '../Export/ExportDialog';
import FieldDialog from './FieldDialog';

const { colors } = theme;

const SummaryBar = styled(
	Card,
	({ colors }) => `
		padding: 12px 16px;

		& .stat-value {
			font-size: 28px;
			font-weight: 700;
			color: ${colors.white};
			line-height: 1.1;
		}

		& .stat-label {
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.07em;
			color: ${colors.gray};
			margin-top: 2px;
		}

		& .stat-sub {
			font-size: 11px;
			color: ${colors.gray};
			margin-top: 6px;
		}
	`,
);

// A field's key facts across the top of its detail: value over a small caption
const Stats = styled(
	Component,
	({ colors }) => `
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		padding: 4px 0 12px;
		border-bottom: 1px solid ${colors.border};
		margin-bottom: 12px;

		& .stat-value {
			font-size: 14px;
			font-weight: 600;
			color: ${colors.muted};
		}

		& .stat-label {
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: ${colors.gray};
		}
	`,
);

const HistoryRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 13px;

		& > .emoji {
			flex-shrink: 0;
			font-size: 14px;
		}

		& > .name {
			flex: 1;
			min-width: 0;
			color: ${colors.white};
		}

		& > .meta, & > .date {
			font-size: 11px;
			color: ${colors.gray};
		}

		& > .date {
			flex-shrink: 0;
		}
	`,
);

// This season's crops, cover and stock, grouped by kind
const UseSummary = styled(
	Card,
	({ colors }) => `
		padding: 8px 12px;
		font-size: 12px;

		& .use-title, & .use-group {
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.07em;
			color: ${colors.gray};
		}

		& .use-title {
			margin-bottom: 6px;
		}

		& .use-row {
			display: flex;
			align-items: baseline;
			gap: 12px;
			margin-bottom: 3px;
		}

		& .use-group {
			flex-shrink: 0;
			min-width: 36px;
		}

		& .use-items {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			color: ${colors.white};
		}
	`,
);

const LeaseWarning = styled(
	Component,
	({ colors, radius }) => `
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 12px;
		border: 1px solid ${colors.alpha(colors.orange, 0.35)};
		border-radius: ${radius.md};
		background: ${colors.alpha(colors.orange, 0.12)};
		font-size: 13px;

		& > .warning-title {
			margin-bottom: 2px;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.07em;
			color: ${colors.light(colors.orange)};
		}
	`,
);

const CardTitleRow = styled(
	Component,
	({ colors, radius }) => `
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;

		& > .card-title {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		& > .facts {
			display: flex;
			align-items: center;
			gap: 6px;
			flex-shrink: 0;
		}

		& .acres {
			font-size: 13px;
			font-weight: 600;
			color: ${colors.white};
		}

		& .rented {
			padding: 1px 5px;
			border-radius: ${radius.sm};
			background: ${colors.alpha(colors.orange, 0.15)};
			font-size: 10px;
			color: ${colors.light(colors.orange)};
		}
	`,
);

// Current uses on a field's card; a fenced field draws them inside a ruled box captioned on its edge
const UseBlock = styled(
	Component,
	({ colors, radius }) => `
		position: relative;
		margin-top: 6px;

		&.fenced {
			padding: 5px 8px;
			border: 1px solid ${colors.alpha(colors.white, 0.18)};
			border-radius: ${radius.sm};
		}

		& > .fence-label {
			position: absolute;
			top: -8px;
			left: 8px;
			padding: 0 4px;
			/* Solid, so the border doesn't run through it: the page under a card's 5% white */
			background: ${colors.black.mix(colors.white, 5)};
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: ${colors.gray};
		}

		& > .empty {
			padding: 1px 0;
			font-size: 12px;
			font-style: italic;
			color: ${colors.gray};
		}

		& > .use {
			padding: 1px 0;
			overflow: hidden;
			font-size: 13px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
);

const USE_COLORS = {
	livestock: colors.light(colors.orange),
	crop: colors.light(colors.yellow),
	cover_crop: colors.light(colors.green),
};

const renewalColor = days => (days <= 30 ? colors.light(colors.danger) : colors.light(colors.orange));

const daysUntil = dateStr => {
	if (!dateStr) return null;

	return Math.ceil((new Date(dateStr) - new Date()) / 86_400_000);
};

export default class Fields extends AsyncView {
	_selectedField = null;

	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', gap: 8, wrap: false });
		this.content = new PageView({ appendTo: this });
	}

	// A fresh heading each time: emptying the bar takes the old one with it
	_resetToolbar(heading) {
		this.toolbar.empty();
		this.toolbar.options.heading = null;
		this.toolbar.options.heading = heading;
	}

	_renderListToolbar() {
		if (this._toolbarMode === 'list') return;

		this._toolbarMode = 'list';
		this._resetToolbar('Fields');

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-export' }),
			title: 'Export data',
			onPointerPress: () => new ExportDialog(),
		});
		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'plus' }),
			title: 'Add field',
			onPointerPress: () =>
				new FieldDialog({
					onSave: async data => {
						const result = await createField({ body: data });

						if (result?.status === 'error') return result;

						if (result?.body && this.fields?.body) {
							this.fields.body[result.body.id] = result.body;
							this._renderList();
						}
					},
				}),
		});
	}

	_datasources() {
		return { fields: getFields, leases: getLeases, events: getEvents };
	}

	_onData() {
		context.hasLeases = Object.keys(this.leases?.body || {}).length > 0;

		const open = this._selectedField && this.fields?.body?.[this._selectedField.id];

		if (open) {
			this._selectedField = open;
			this._renderDetail();
		} else {
			this._selectedField = null;
			this._renderList();
		}
	}

	_renderList() {
		this.content.empty();
		this._renderListToolbar();

		const fieldList = Object.values(this.fields?.body || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		if (!fieldList.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'wheat-awn',
				title: 'No fields yet',
				message: 'Add a field from the Map view or tap + above',
			});
			return;
		}

		this._renderSummary(fieldList);

		for (const field of fieldList) {
			this._renderFieldCard(field);
		}
	}

	_renderDetail() {
		this.content.empty();

		const field = this._selectedField;
		const fieldEvents = Object.values(this.events?.body || {}).filter(e => e.fieldId === field.id);

		this._toolbarMode = 'detail';
		this._resetToolbar(field.name || 'Field');

		new Button({
			appendTo: this.toolbar,
			addClass: 'start',
			variant: 'flat',
			icon: 'arrow-left',
			textContent: 'Back',
			onPointerPress: () => {
				this._selectedField = null;
				this._renderList();
			},
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'pencil' }),
			title: 'Edit field',
			onPointerPress: () =>
				new FieldDialog({
					field,
					onSave: async data => {
						const result = await updateField(field.id, { body: { ...data, _v: field._v } });

						if (result?.status === 'error') return result;

						if (result?.body && this.fields?.body) {
							this.fields.body[field.id] = result.body;
							this._selectedField = result.body;
							this._renderDetail();
						}
					},
					onDelete: async () => {
						const result = await deleteField(field.id);

						if (result?.status === 'error') return result;

						if (this.fields?.body) delete this.fields.body[field.id];
						this._selectedField = null;
						this._renderList();
					},
				}),
		});

		// Key stats
		const stats = new Stats({ appendTo: this.content });

		const addStat = (label, value, color) => {
			if (!value) return;
			const s = new Component({ appendTo: stats });

			new Elem({ tag: 'div', appendTo: s, addClass: 'stat-value', style: color && { color }, textContent: value });
			new Elem({ tag: 'div', appendTo: s, addClass: 'stat-label', textContent: label });
		};

		addStat('Acreage', field.acreage ? formatArea(field.acreage, field.acreageUnit || 'ac') : null);
		const tenureLabel = field.tenure === 'rent' ? 'Rented' : null;
		addStat('Tenure', field.tenure === 'own' ? 'Owned' : tenureLabel);
		addStat('Location', [field.county, field.state].filter(Boolean).join(', ') || null);
		if (field.status) addStat('Status', field.status.replace(/_/g, ' '), colors.light(colors.warning));

		// Charts — requires ≥1 season of data
		const years = new Set(
			fieldEvents.map(e => e.season || (e.date ? new Date(e.date).getFullYear() : null)).filter(Boolean),
		);

		if (years.size >= 1) {
			new SectionLabel({ appendTo: this.content, textContent: 'Trends' });
			new SeasonCharts({
				appendTo: this.content,
				events: fieldEvents,
				fields: { [field.id]: field },
				fieldFilter: field.id,
			});
		}

		// Event history grouped by year
		const byYear = new Map();

		for (const event of fieldEvents) {
			const yr = event.season || (event.date ? new Date(event.date).getFullYear() : null);

			if (!yr) continue;
			if (!byYear.has(yr)) byYear.set(yr, []);
			byYear.get(yr).push(event);
		}

		if (byYear.size) {
			new SectionLabel({ appendTo: this.content, textContent: 'History' });

			for (const yr of [...byYear.keys()].sort((a, b) => b - a)) {
				const yearEvents = byYear.get(yr).sort((a, b) => new Date(b.date) - new Date(a.date));

				new SectionLabel({ appendTo: this.content, level: 4, textContent: String(yr) });

				for (const event of yearEvents) {
					const details = parseDetails(event.details);
					const row = new HistoryRow({ appendTo: this.content });

					new Elem({ tag: 'span', appendTo: row, addClass: 'emoji', textContent: eventEmoji(event) });
					new Elem({
						tag: 'span',
						appendTo: row,
						addClass: 'name',
						textContent: event.name || categoryMeta(event.category)?.label?.replace(/^[^\s]+\s/, '') || event.category,
					});

					const meta = [];

					if (event.category === 'harvest' && details.quantity) meta.push(`${details.quantity} ${details.unit || ''}`);
					if (event.category === 'harvest' && details.revenue) meta.push(`$${Number(details.revenue).toFixed(0)}`);
					if (event.category === 'soil_test' && details.organicMatter) meta.push(`OM ${details.organicMatter}%`);
					if (event.category === 'soil_test' && details.pH) meta.push(`pH ${details.pH}`);

					if (meta.length)
						new Elem({
							tag: 'span',
							appendTo: row,
							addClass: 'meta',
							textContent: meta.join(' · '),
						});
					if (event.date)
						new Elem({
							tag: 'span',
							appendTo: row,
							addClass: 'date',
							textContent: new Date(event.date).toLocaleDateString(),
						});
				}
			}
		}
	}

	_renderSummary(fieldList) {
		// Normalize all areas to sqm first, then convert to acres for display
		const totalSqm = fieldList.reduce((sum, f) => sum + toSqm(f.acreage, f.acreageUnit || 'ac'), 0);
		const owned = fieldList.filter(f => f.tenure === 'own');
		const rented = fieldList.filter(f => f.tenure === 'rent');
		const ownedSqm = owned.reduce((sum, f) => sum + toSqm(f.acreage, f.acreageUnit || 'ac'), 0);
		const rentedSqm = rented.reduce((sum, f) => sum + toSqm(f.acreage, f.acreageUnit || 'ac'), 0);

		const formatAcreage = sqm => (sqm > 0 ? `${convertArea(sqm, 'ac').toFixed(1)} ac` : null);

		const summary = new SummaryBar({ appendTo: this.content });

		// Primary: total acreage
		new Elem({
			tag: 'div',
			appendTo: summary,
			addClass: 'stat-value',
			textContent: formatAcreage(totalSqm) || `${fieldList.length}`,
		});
		new Elem({
			tag: 'div',
			appendTo: summary,
			addClass: 'stat-label',
			textContent: formatAcreage(totalSqm) ? `${fieldList.length} field${fieldList.length !== 1 ? 's' : ''}` : 'Fields',
		});

		// Tenure as a quiet secondary line — only if both exist
		const tenureParts = [];

		if (owned.length)
			tenureParts.push(`${owned.length} owned${formatAcreage(ownedSqm) ? ` (${formatAcreage(ownedSqm)})` : ''}`);
		if (rented.length)
			tenureParts.push(`${rented.length} rented${formatAcreage(rentedSqm) ? ` (${formatAcreage(rentedSqm)})` : ''}`);

		if (tenureParts.length > 1) {
			new Elem({ tag: 'div', appendTo: summary, addClass: 'stat-sub', textContent: tenureParts.join(' · ') });
		}

		// Current use breakdown from events this season
		const CURRENT_YEAR = new Date().getFullYear();
		const now = new Date();
		const allEvents = Object.values(this.events?.body || {});
		// useMap: key → { sqm, head, isLivestock }
		// useMap: key → { sqm, head, category: 'livestock'|'crop'|'cover_crop' }
		const useMap = new Map();

		for (const field of fieldList) {
			const fieldEvents = allEvents.filter(e => e.fieldId === field.id);
			const fieldSqm = toSqm(field.acreage, field.acreageUnit || 'ac');

			// All three categories checked independently — a field can have multiple active uses

			// Active livestock (by date range)
			for (const event of fieldEvents.filter(
				e =>
					e.category === 'livestock' && e.date && new Date(e.date) <= now && (!e.endDate || new Date(e.endDate) >= now),
			)) {
				const details = parseDetails(event.details);
				const icon = eventEmoji(event);
				const key = `${icon} ${event.name?.split('(')[0]?.trim() || 'Livestock'}`;
				const prev = useMap.get(key) || { sqm: 0, head: 0, category: 'livestock' };

				useMap.set(key, { ...prev, head: prev.head + (Number(details.headCount) || 0) });
			}

			// Cash crops this season
			const crop = fieldEvents
				.filter(e => e.category === 'crop' && e.season === CURRENT_YEAR)
				.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

			if (crop) {
				const details = parseDetails(crop.details);
				const icon = eventEmoji(crop);
				const key = `${icon} ${details.species || crop.name || 'Crop'}`;
				const prev = useMap.get(key) || { sqm: 0, head: 0, category: 'crop' };

				useMap.set(key, { ...prev, sqm: prev.sqm + fieldSqm });
			}

			// Cover crops this season
			for (const event of fieldEvents.filter(e => e.category === 'cover_crop' && e.season === CURRENT_YEAR)) {
				const icon = eventEmoji(event);
				const key = `${icon} ${event.name || 'Cover Crop'}`;
				const prev = useMap.get(key) || { sqm: 0, head: 0, category: 'cover_crop' };

				useMap.set(key, { ...prev, sqm: prev.sqm + fieldSqm });
			}
		}

		if (useMap.size) {
			const useBar = new UseSummary({ appendTo: this.content });

			new Elem({ tag: 'div', appendTo: useBar, addClass: 'use-title', textContent: `${CURRENT_YEAR} — current use` });

			const groups = [
				{ cat: 'crop', label: 'Crops' },
				{ cat: 'cover_crop', label: 'Cover' },
				{ cat: 'livestock', label: 'Stock' },
			];

			for (const { cat, label: groupLabel } of groups) {
				const items = [...useMap.entries()]
					.filter(([, v]) => v.category === cat)
					.sort((a, b) => (b[1].sqm || b[1].head) - (a[1].sqm || a[1].head));

				if (!items.length) continue;

				const row = new Component({ appendTo: useBar, addClass: 'use-row' });

				new Elem({ tag: 'span', appendTo: row, addClass: 'use-group', textContent: groupLabel });

				const itemsRow = new Component({ appendTo: row, addClass: 'use-items' });

				for (const [label, { sqm, head, category }] of items) {
					const livestockMetric = head > 0 ? String(head) : 'active';
					const metric = category === 'livestock' ? livestockMetric : `${convertArea(sqm, 'ac').toFixed(1)} ac`;

					new Elem({ tag: 'span', appendTo: itemsRow, textContent: `${label}  ${metric}` });
				}
			}
		}

		// Lease renewal warnings
		const leaseList = Object.values(this.leases?.body || {});
		const urgentLeases = leaseList
			.map(l => ({ lease: l, days: daysUntil(l.renewalDate) }))
			.filter(({ days }) => days !== null && days <= 90)
			.sort((a, b) => a.days - b.days);

		if (urgentLeases.length) {
			const warn = new LeaseWarning({ appendTo: this.content });

			new Elem({
				tag: 'div',
				appendTo: warn,
				addClass: 'warning-title',
				textContent: `${urgentLeases.length} lease renewal${urgentLeases.length !== 1 ? 's' : ''} coming up`,
			});

			for (const { lease, days } of urgentLeases.slice(0, 3)) {
				const field = this.fields?.body?.[lease.entityId];
				new Elem({
					tag: 'div',
					appendTo: warn,
					style: { color: renewalColor(days) },
					textContent: `${field?.name || 'Unknown field'} — ${days <= 0 ? 'past due' : `${days} days`} (${lease.landlordName || 'landlord'})`,
				});
			}
		}
	}

	_renderFieldCard(field) {
		const card = new RecordCard({
			appendTo: this.content,
			onPointerPress: () => {
				this._selectedField = field;
				this._renderDetail();
			},
		});

		const titleRow = new CardTitleRow({ appendTo: card });

		new Elem({ tag: 'div', appendTo: titleRow, addClass: 'card-title', textContent: field.name || 'Unnamed Field' });

		// Acreage as the prominent right-side number — tenure shown only as a tiny muted badge
		const rightMeta = new Elem({ tag: 'div', appendTo: titleRow, addClass: 'facts' });

		if (field.acreage)
			new Elem({
				tag: 'span',
				appendTo: rightMeta,
				addClass: 'acres',
				textContent: formatArea(field.acreage, field.acreageUnit || 'ac'),
			});
		if (field.tenure === 'rent')
			new Elem({
				tag: 'span',
				appendTo: rightMeta,
				addClass: 'rented',
				textContent: 'rented',
			});

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

		if (field.county || field.state)
			new Elem({ tag: 'span', appendTo: meta, textContent: [field.county, field.state].filter(Boolean).join(', ') });

		// Current use from events
		const CURRENT_YEAR = new Date().getFullYear();
		const now = new Date();
		const fieldEvents = Object.values(this.events?.body || {}).filter(e => e.fieldId === field.id);

		const activeUses = [
			...fieldEvents.filter(
				e =>
					e.category === 'livestock' && e.date && new Date(e.date) <= now && (!e.endDate || new Date(e.endDate) >= now),
			),
			...fieldEvents
				.filter(e => e.category === 'crop' && e.season === CURRENT_YEAR)
				.sort((a, b) => new Date(b.date) - new Date(a.date))
				.slice(0, 1),
			...fieldEvents.filter(e => e.category === 'cover_crop' && e.season === CURRENT_YEAR),
		];

		// Current use — dedicated block, not inline in meta; always shown for fenced fields
		if (activeUses.length || field.fencing) {
			// Fenced: wrap use block in a box to represent the fence boundary
			const useWrap = new UseBlock({ appendTo: card, addClass: field.fencing ? 'fenced' : [] });

			if (field.fencing) {
				const fenceLabel = new Elem({ tag: 'span', appendTo: useWrap, addClass: 'fence-label' });

				fenceLabel.elem.textContent = '⊞ fenced';
			}

			if (!activeUses.length) {
				new Elem({
					tag: 'div',
					appendTo: useWrap,
					addClass: 'empty',
					textContent: 'Empty',
				});
			}

			for (const event of activeUses) {
				const details = parseDetails(event.details);
				const label =
					event.category === 'crop' ? details.species || event.name : event.name || event.category.replace('_', ' ');

				new Elem({
					tag: 'div',
					appendTo: useWrap,
					addClass: 'use',
					style: { color: USE_COLORS[event.category] || colors.muted },
					textContent: `${eventEmoji(event)} ${label}`,
				});
			}
		}

		// Lease renewal warning — compact, below use block
		const fieldLease = Object.values(this.leases?.body || {}).find(l => l.entityId === field.id);

		if (fieldLease) {
			const days = daysUntil(fieldLease.renewalDate);

			if (days !== null && days <= 90) {
				new Elem({
					tag: 'div',
					appendTo: card,
					style: { fontSize: '11px', color: renewalColor(days), marginTop: '4px' },
					textContent: days <= 0 ? 'Lease renewal past due' : `Lease renewal in ${days} days`,
				});
			}
		}
	}
}
