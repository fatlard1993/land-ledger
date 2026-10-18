import { Button, Component, Elem, EmptyState, Icon, styled } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getFields, getLeases, getEvents, createField, updateField, deleteField } from '../api';
import context from '../context';
import { toSqm, convertArea, formatArea } from '../geo';
import parseDetails from '../utils/parseDetails';
import { eventEmoji, categoryMeta } from '../Timeline/EventDialog';
import { PageView, PageToolbar, PageTitle, Card, SectionHeader } from '../Layout';
import SeasonCharts from '../Charts/SeasonCharts';

import ExportDialog from '../Export/ExportDialog';
import FieldDialog from './FieldDialog';

const SummaryBar = styled(
	Component,
	({ colors }) => `
		background: ${colors.darker(colors.gray)};
		border: 1px solid ${colors.dark(colors.gray)};
		border-radius: 8px;
		padding: 12px 16px;
		margin-bottom: 10px;

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
			color: rgba(255,255,255,0.3);
			margin-top: 6px;
		}
	`,
);

const daysUntil = dateStr => {
	if (!dateStr) return null;

	return Math.ceil((new Date(dateStr) - new Date()) / 86_400_000);
};

export default class Fields extends AsyncView {
	_selectedField = null;

	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Fields' });
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

						if (result?.body && this.fields?.body) {
							this.fields.body[result.body.id] = result.body;
							this._renderList();
						}
					},
				}),
		});

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { fields: getFields, leases: getLeases, events: getEvents };
	}

	_onData() {
		context.hasLeases = Object.keys(this.leases?.body || {}).length > 0;
		this._renderList();
	}

	_renderList() {
		this.content.empty();
		// Restore toolbar when returning from detail view
		if (this.toolbar.elem.children.length === 0 || !this.toolbar.elem.querySelector('.page-title')) {
			this.toolbar.empty();
			new PageTitle({ appendTo: this.toolbar, textContent: 'Fields' });
			new Button({
				appendTo: this.toolbar,
				append: new Icon({ icon: 'plus' }),
				title: 'Add field',
				onPointerPress: () =>
					new FieldDialog({
						onSave: async data => {
							const result = await createField({ body: data });

							if (result?.body && this.fields?.body) {
								this.fields.body[result.body.id] = result.body;
								this._renderList();
							}
						},
					}),
			});
		}

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
		this.toolbar.empty();

		const field = this._selectedField;
		const fieldEvents = Object.values(this.events?.body || {}).filter(e => e.fieldId === field.id);

		// Toolbar: back + field name + edit
		const backBtn = new Button({
			appendTo: this.toolbar,
			textContent: '← Back',
			style: { fontSize: '13px', padding: '4px 10px' },
			onPointerPress: () => {
				this._selectedField = null;
				this._renderList();
			},
		});

		void backBtn;

		new PageTitle({ appendTo: this.toolbar, textContent: field.name || 'Field' });

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'pencil' }),
			title: 'Edit field',
			onPointerPress: () =>
				new FieldDialog({
					field,
					onSave: async data => {
						const result = await updateField(field.id, { body: { ...data, _v: field._v } });

						if (result?.body && this.fields?.body) {
							this.fields.body[field.id] = result.body;
							this._selectedField = result.body;
							this._renderDetail();
						}
					},
					onDelete: async () => {
						await deleteField(field.id);
						if (this.fields?.body) delete this.fields.body[field.id];
						this._selectedField = null;
						this._renderList();
					},
				}),
		});

		// Key stats
		const stats = new Component({
			appendTo: this.content,
			style: {
				display: 'flex',
				gap: '12px',
				flexWrap: 'wrap',
				padding: '4px 0 12px',
				borderBottom: '1px solid rgba(255,255,255,0.07)',
				marginBottom: '12px',
			},
		});

		const addStat = (label, value, color = 'rgba(255,255,255,0.7)') => {
			if (!value) return;
			const s = new Component({ appendTo: stats });

			new Elem({ tag: 'div', appendTo: s, style: { fontSize: '14px', fontWeight: '600', color }, textContent: value });
			new Elem({
				tag: 'div',
				appendTo: s,
				style: {
					fontSize: '10px',
					textTransform: 'uppercase',
					letterSpacing: '.06em',
					color: 'rgba(255,255,255,0.35)',
				},
				textContent: label,
			});
		};

		addStat('Acreage', field.acreage ? formatArea(field.acreage, field.acreageUnit || 'ac') : null);
		const tenureLabel = field.tenure === 'rent' ? 'Rented' : null;
		addStat('Tenure', field.tenure === 'own' ? 'Owned' : tenureLabel);
		addStat('Location', [field.county, field.state].filter(Boolean).join(', ') || null);
		if (field.status) addStat('Status', field.status.replace(/_/g, ' '), '#e8c42a');

		// Charts — requires ≥1 season of data
		const years = new Set(
			fieldEvents.map(e => e.season || (e.date ? new Date(e.date).getFullYear() : null)).filter(Boolean),
		);

		if (years.size >= 1) {
			new SectionHeader({ appendTo: this.content, textContent: 'Trends' });
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
			new SectionHeader({ appendTo: this.content, textContent: 'History' });

			for (const yr of [...byYear.keys()].sort((a, b) => b - a)) {
				const yearEvents = byYear.get(yr).sort((a, b) => new Date(b.date) - new Date(a.date));

				new Elem({
					tag: 'div',
					appendTo: this.content,
					style: {
						fontSize: '11px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.3)',
						padding: '8px 0 4px',
					},
					textContent: String(yr),
				});

				for (const event of yearEvents) {
					const details = parseDetails(event.details);
					const row = new Component({
						appendTo: this.content,
						style: {
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							padding: '4px 0',
							borderBottom: '1px solid rgba(255,255,255,0.06)',
							fontSize: '13px',
						},
					});

					new Elem({
						tag: 'span',
						appendTo: row,
						style: { fontSize: '14px', flexShrink: '0' },
						textContent: eventEmoji(event),
					});
					new Elem({
						tag: 'span',
						appendTo: row,
						style: { flex: '1', color: 'rgba(255,255,255,0.8)' },
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
							style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
							textContent: meta.join(' · '),
						});
					if (event.date)
						new Elem({
							tag: 'span',
							appendTo: row,
							style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: '0' },
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
			const useBar = new Component({
				appendTo: this.content,
				style: {
					background: 'rgba(255,255,255,0.03)',
					border: '1px solid rgba(255,255,255,0.08)',
					borderRadius: '6px',
					padding: '8px 12px',
					marginBottom: '8px',
					fontSize: '12px',
				},
			});

			new Elem({
				tag: 'div',
				appendTo: useBar,
				style: {
					fontSize: '10px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(255,255,255,0.35)',
					marginBottom: '6px',
				},
				textContent: `${CURRENT_YEAR} — current use`,
			});

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

				const row = new Component({
					appendTo: useBar,
					style: { display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '3px' },
				});

				new Elem({
					tag: 'span',
					appendTo: row,
					style: {
						fontSize: '10px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.3)',
						minWidth: '36px',
						flexShrink: '0',
					},
					textContent: groupLabel,
				});

				const itemsRow = new Component({ appendTo: row, style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } });

				for (const [label, { sqm, head, category }] of items) {
					const livestockMetric = head > 0 ? String(head) : 'active';
					const metric = category === 'livestock' ? livestockMetric : `${convertArea(sqm, 'ac').toFixed(1)} ac`;

					new Elem({
						tag: 'span',
						appendTo: itemsRow,
						style: { color: 'rgba(255,255,255,0.75)' },
						textContent: `${label}  ${metric}`,
					});
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
			const warn = new Component({
				appendTo: this.content,
				style: {
					background: 'rgba(232,131,42,0.12)',
					border: '1px solid rgba(232,131,42,0.3)',
					borderRadius: '6px',
					padding: '8px 12px',
					marginBottom: '10px',
					fontSize: '13px',
					display: 'flex',
					flexDirection: 'column',
					gap: '4px',
				},
			});

			new Elem({
				tag: 'div',
				appendTo: warn,
				style: {
					fontSize: '11px',
					textTransform: 'uppercase',
					letterSpacing: '.07em',
					color: 'rgba(232,131,42,0.8)',
					marginBottom: '2px',
				},
				textContent: `${urgentLeases.length} lease renewal${urgentLeases.length !== 1 ? 's' : ''} coming up`,
			});

			for (const { lease, days } of urgentLeases.slice(0, 3)) {
				const field = this.fields?.body?.[lease.entityId];
				const color = days <= 30 ? '#e05252' : '#e8832a';

				new Elem({
					tag: 'div',
					appendTo: warn,
					style: { color },
					textContent: `${field?.name || 'Unknown field'} — ${days <= 0 ? 'past due' : `${days} days`} (${lease.landlordName || 'landlord'})`,
				});
			}
		}
	}

	_renderFieldCard(field) {
		const card = new Card({
			appendTo: this.content,
			onPointerPress: () => {
				this._selectedField = field;
				this._renderDetail();
			},
		});

		const titleRow = new Elem({
			tag: 'div',
			appendTo: card,
			style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
		});

		new Elem({ tag: 'div', appendTo: titleRow, addClass: 'card-title', textContent: field.name || 'Unnamed Field' });

		// Acreage as the prominent right-side number — tenure shown only as a tiny muted badge
		const rightMeta = new Elem({
			tag: 'div',
			appendTo: titleRow,
			style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0' },
		});

		if (field.acreage)
			new Elem({
				tag: 'span',
				appendTo: rightMeta,
				style: { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
				textContent: formatArea(field.acreage, field.acreageUnit || 'ac'),
			});
		if (field.tenure === 'rent')
			new Elem({
				tag: 'span',
				appendTo: rightMeta,
				style: {
					fontSize: '10px',
					padding: '1px 5px',
					borderRadius: '3px',
					background: 'rgba(232,131,42,0.15)',
					color: 'rgba(232,131,42,0.7)',
				},
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
			const USE_COLORS = { livestock: '#a0522d', crop: '#e8c42a', cover_crop: '#4caf50' };

			// Fenced: wrap use block in a box to represent the fence boundary
			const useWrap = new Elem({
				tag: 'div',
				appendTo: card,
				style: field.fencing
					? {
							marginTop: '6px',
							border: '1px solid rgba(255,255,255,0.18)',
							borderRadius: '4px',
							padding: '5px 8px',
							position: 'relative',
						}
					: {
							marginTop: '6px',
						},
			});

			if (field.fencing) {
				const fenceLabel = new Elem({
					tag: 'span',
					appendTo: useWrap,
					style: {
						position: 'absolute',
						top: '-8px',
						left: '8px',
						background: 'var(--color-darker-gray, #1a1a1a)',
						fontSize: '9px',
						textTransform: 'uppercase',
						letterSpacing: '.06em',
						color: 'rgba(255,255,255,0.3)',
						padding: '0 4px',
					},
				});

				fenceLabel.elem.textContent = '⊞ fenced';
			}

			if (!activeUses.length) {
				new Elem({
					tag: 'div',
					appendTo: useWrap,
					style: { fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', padding: '1px 0' },
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
					style: {
						fontSize: '13px',
						color: USE_COLORS[event.category] || 'rgba(255,255,255,0.7)',
						padding: '1px 0',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					},
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
					style: { fontSize: '11px', color: days <= 30 ? '#e05252' : '#e8832a', marginTop: '4px' },
					textContent: days <= 0 ? 'Lease renewal past due' : `Lease renewal in ${days} days`,
				});
			}
		}
	}
}
