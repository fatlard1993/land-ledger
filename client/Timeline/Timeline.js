import {
	Button,
	Component,
	Elem,
	EmptyState,
	formatDate,
	Icon,
	parseDate,
	Select,
	styled,
	Tabs,
	theme,
	Toolbar,
} from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getEvents, getFields, createEvent, updateEvent, deleteEvent, getWeather, getCountyYield } from '../api';
import { centroidFromGeometry } from '../geo';
import { PageView } from '../Layout';
import context from '../context';
import SeasonCharts from '../Charts/SeasonCharts';

import TabularImportDialog from '../Import/TabularImportDialog';
import ExportDialog from '../Export/ExportDialog';
import { toDateOnly } from '../utils/dates';
import { categoryMeta } from '../eventCategories';
import EventDialog, { eventEmoji } from './EventDialog';

const { colors, space } = theme;

const CURRENT_YEAR = new Date().getFullYear();

const EventRow = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		align-items: flex-start;
		gap: ${space.md};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		cursor: pointer;
		transition: background 0.1s;

		&:hover {
			background: ${colors.alpha(colors.white, 0.05)};
		}

		& .event-dot {
			width: 28px;
			height: 28px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 13px;
			flex-shrink: 0;
			margin-top: ${space.xs};
		}

		& .event-main {
			flex: 1;
			min-width: 0;
		}

		& .event-name {
			font-size: 14px;
			font-weight: 600;
			color: ${colors.white};
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		& .event-name.planned {
			color: ${colors.muted};
		}

		& .event-meta {
			font-size: 12px;
			color: ${colors.gray};
			margin-top: 1px;
			display: flex;
			gap: ${space.sm};
			flex-wrap: wrap;
		}
	`,
);

const SeasonHeader = styled(
	Component,
	({ colors, space }) => `
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: ${space.xs} ${space.md};
		padding: ${space.md} 0 ${space.xs};
		color: ${colors.gray};

		& > .season {
			font-size: 12px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		& > .note {
			font-size: 11px;
		}
	`,
);

const FilterBar = styled(
	Component,
	({ space }) => `
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: ${space.sm};
		margin-bottom: ${space.sm};

		& > select {
			flex: 1;
			width: auto;
			min-width: 0;
		}
	`,
);

// A field-by-season grid that scrolls sideways inside itself on a narrow screen
const YieldTable = styled(
	Component,
	({ colors, space }) => `
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;

		& th {
			padding: ${space.sm} ${space.sm};
			color: ${colors.gray};
			font-weight: 600;
			border-bottom: 2px solid ${colors.border};
			text-align: center;
			white-space: nowrap;
		}

		& th:first-child {
			text-align: left;
		}

		& td {
			padding: ${space.sm} ${space.sm};
			border-bottom: 1px solid ${colors.border};
			text-align: center;
			vertical-align: top;
		}

		& td.field {
			text-align: left;
			white-space: nowrap;
			font-weight: 600;
		}

		& .acres, & .crop {
			font-size: 10px;
			font-weight: 400;
			color: ${colors.gray};
		}

		& .yield {
			color: ${colors.white};
			font-weight: 600;
		}

		& .crop-only {
			font-size: 11px;
			color: ${colors.muted};
		}

		& .badges {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: ${space.xs};
			margin-top: ${space.xs};
			font-size: 12px;
			cursor: default;
		}

		& td.empty {
			cursor: pointer;
			color: ${colors.alpha(colors.white, 0.2)};
			font-size: 10px;
		}
	`,
	{ tag: 'table' },
);

const Footnote = styled(
	Component,
	({ colors, space }) => `
		margin-top: ${space.md};
		font-size: 11px;
		line-height: 1.6;
		color: ${colors.gray};
	`,
	{ tag: 'p' },
);

export default class Timeline extends AsyncView {
	_view = 'timeline'; // 'timeline' | 'insights'
	_fieldFilter = null;

	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Timeline', gap: 8, wrap: false });

		this._viewTabs = new Tabs({
			appendTo: this.toolbar,
			variant: 'segmented',
			tabs: [
				{ id: 'timeline', label: 'Log' },
				{ id: 'insights', label: 'Insights' },
			],
			selected: this._view,
			onChange: ({ value }) => this._switchView(value),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'plus' }),
			title: 'Log event',
			onPointerPress: () => this._openEventDialog(),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-import' }),
			title: 'Import CSV / JSON',
			onPointerPress: () => new TabularImportDialog({ initialCollection: 'events' }),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-export' }),
			title: 'Export data',
			onPointerPress: () => new ExportDialog(),
		});

		this.content = new PageView({ appendTo: this });
	}

	async _loadData() {
		this._dataReady = false;

		// Also called for this load's own fetches, before they resolve; only a later fetch is news
		const [events, fields] = await Promise.all([
			getEvents({
				onSuccess: response => {
					if (!this._dataReady) return;

					this.events = response;
					this._renderCurrent();
				},
				scope: this.signal,
			}),
			getFields({
				onSuccess: response => {
					if (!this._dataReady) return;

					this.fields = response;
					this._renderCurrent();
				},
				scope: this.signal,
			}),
		]);

		this.events = events;
		this.fields = fields;
		this._dataReady = true;

		// Check if navigated here with a field filter (e.g. from FieldPanel)
		if (context.timelineFieldFilter) {
			this._fieldFilter = context.timelineFieldFilter;
			context.timelineFieldFilter = null;
			const filterField = this.fields?.body?.[this._fieldFilter];

			if (filterField) this.toolbar.options.heading = filterField.name;
		}

		this._switchView('timeline');
	}

	_switchView(view) {
		this._view = view;
		this._viewTabs.options.selected = view;
		this._renderCurrent();
	}

	_renderCurrent() {
		if (this._view === 'insights') this._renderInsights();
		else this._renderTimeline();
	}

	_renderFilterBar() {
		const fieldList = Object.values(this.fields?.body || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		if (!fieldList.length) return;

		const bar = new FilterBar({ appendTo: this.content });

		const filterSelect = new Select({ appendTo: bar });

		const allOpt = document.createElement('option');

		allOpt.value = '';
		allOpt.textContent = 'All fields';
		filterSelect.elem.append(allOpt);

		for (const field of fieldList) {
			const opt = document.createElement('option');

			opt.value = field.id;
			opt.textContent = field.name || 'Unnamed Field';
			filterSelect.elem.append(opt);
		}

		filterSelect.elem.value = this._fieldFilter || '';

		filterSelect.elem.addEventListener('change', () => {
			this._fieldFilter = filterSelect.elem.value || null;
			const selectedField = this.fields?.body?.[this._fieldFilter];

			this.toolbar.options.heading = selectedField ? selectedField.name : 'Timeline';
			this._renderTimeline();
		});

		if (this._fieldFilter) {
			new Button({
				appendTo: bar,
				variant: 'flat',
				icon: 'xmark',
				textContent: 'Clear',
				onPointerPress: () => {
					this._fieldFilter = null;
					this.toolbar.options.heading = 'Timeline';
					this._renderTimeline();
				},
			});
		}
	}

	_renderTimeline() {
		this.content.empty();

		this._renderFilterBar();

		const allEvents = Object.values(this.events?.body || {})
			.filter(e => !this._fieldFilter || e.fieldId === this._fieldFilter)
			.sort((a, b) => {
				// Per-field view: oldest first (journal/longitudinal); all-fields: newest first
				if (this._fieldFilter) return parseDate(a.date) - parseDate(b.date);
				return parseDate(b.date) - parseDate(a.date);
			});

		if (!allEvents.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'calendar-days',
				title: 'No events logged yet',
				message: 'Log crops, livestock, cover crops, inputs, and soil tests — tap + to start',
			});

			return;
		}

		let lastSeason = null;
		const field = this._fieldFilter ? this.fields?.body?.[this._fieldFilter] : null;

		for (const event of allEvents) {
			const season = event.season || parseDate(event.date)?.getFullYear() || CURRENT_YEAR;

			if (season !== lastSeason) {
				const seasonHeader = new SeasonHeader({ appendTo: this.content });

				new Elem({ tag: 'span', appendTo: seasonHeader, addClass: 'season', textContent: String(season) });

				// Weather + county benchmark — only when filtering by a specific field
				if (field?.geometry && season <= CURRENT_YEAR) {
					const weatherSlot = new Elem({ tag: 'span', appendTo: seasonHeader, addClass: 'note', textContent: '…' });

					this._loadSeasonWeather(season, field, weatherSlot);

					// County yield benchmark — if field has state/county and a harvest event exists
					const harvestEvents = allEvents.filter(
						e =>
							e.fieldId === field.id &&
							(e.season === season || parseDate(e.date)?.getFullYear() === season) &&
							e.category === 'harvest',
					);

					if (field.state && field.county && harvestEvents.length) {
						const benchmarkSlot = new Elem({ tag: 'span', appendTo: seasonHeader, addClass: 'note' });
						this._loadSeasonBenchmark(season, field, harvestEvents, benchmarkSlot);
					}
				}

				lastSeason = season;
			}

			this._renderEventRow(event);
		}
	}

	async _loadSeasonWeather(year, field, slot) {
		const centroid = centroidFromGeometry(field.geometry);

		if (!centroid) {
			slot.elem.textContent = '';
			return;
		}

		const start = `${year}-01-01`;
		const today = toDateOnly();
		const end = year < CURRENT_YEAR ? `${year}-12-31` : today;

		let data;

		try {
			data = await getWeather({ lat: centroid.lat, lng: centroid.lon, start, end });
		} catch {
			slot.elem.textContent = '';
			return;
		}

		if (!slot.elem.isConnected || !data) {
			slot.elem.textContent = '';
			return;
		}

		const days = Object.entries(data);

		if (!days.length) {
			slot.elem.textContent = '';
			return;
		}

		// Growing season avg high (May–Aug)
		const growing = days.filter(([d]) => {
			const m = parseDate(d).getMonth();
			return m >= 4 && m <= 7;
		});
		const avgHigh = growing.length
			? Math.round(growing.reduce((s, [, d]) => s + (d.tempMax ?? 0), 0) / growing.length)
			: null;

		// Annual totals
		const totalPrecip = days.reduce((s, [, d]) => s + (d.precipitation ?? 0), 0);
		const frostDays = days.filter(([, d]) => d.tempMin != null && d.tempMin <= 32).length;

		const parts = [];

		if (avgHigh != null) parts.push(`${avgHigh}° avg`);
		if (totalPrecip > 0) parts.push(`${totalPrecip.toFixed(1)}" rain`);
		if (frostDays > 0) parts.push(`${frostDays} frost day${frostDays !== 1 ? 's' : ''}`);

		slot.elem.textContent = parts.length ? parts.join('  ·  ') : '';
	}

	async _loadSeasonBenchmark(year, field, harvestEvents, slot) {
		// Prefer an event with both a recognizable name AND yield; fall back to name-only
		let crop = null;
		let farmYield = null;

		for (const e of harvestEvents) {
			const d = typeof e.details === 'object' ? e.details : {};
			const name = (d.outputType || e.name || '').toLowerCase().trim();
			if (name && d.yieldPerAcre != null) {
				crop = name;
				farmYield = Number(d.yieldPerAcre);
				break;
			} else if (!crop && name) {
				crop = name; // fallback: have name but no yield yet
			}
		}

		if (!crop) {
			slot.elem.textContent = '';
			return;
		}

		let benchmark;
		try {
			benchmark = await getCountyYield({ state: field.state, county: field.county, crop, year });
		} catch {
			slot.elem.textContent = '';
			return;
		}

		if (!slot.elem.isConnected || !benchmark?.value) {
			slot.elem.textContent = '';
			return;
		}

		const countyAvg = benchmark.value;
		const unit = benchmark.unit?.replace(' / ACRE', '/ac').toLowerCase() ?? '';

		if (farmYield != null) {
			const delta = ((farmYield - countyAvg) / countyAvg) * 100;
			const sign = delta >= 0 ? '+' : '';
			let color;
			if (delta >= 5) color = colors.light(colors.success);
			else if (delta <= -5) color = colors.light(colors.danger);
			else color = colors.muted;
			const text = `County avg ${countyAvg.toFixed(1)} ${unit}  ·  ${sign}${delta.toFixed(0)}% vs avg`;

			slot.elem.textContent = text;
			slot.elem.style.color = `${color}`;
		} else {
			// No farm yield recorded — show county average as reference only
			slot.elem.textContent = `County avg: ${countyAvg.toFixed(1)} ${unit}`;
			slot.elem.style.color = `${colors.gray}`;
		}
	}

	_renderEventRow(event, appendTo) {
		const target = appendTo || this.content;
		const field = this.fields?.body?.[event.fieldId];
		const meta = categoryMeta(event.category);
		const details = this._parseDetails(event.details);

		const row = new EventRow({
			appendTo: target,
			onPointerPress: () => this._openEventDialog(event),
		});

		const dot = new Elem({ tag: 'div', appendTo: row, addClass: 'event-dot' });

		dot.elem.style.background = `${colors.alpha(meta.color, 0.13)}`;
		dot.elem.style.border = `1px solid ${colors.alpha(meta.color, 0.33)}`;
		dot.elem.textContent = eventEmoji(event);

		const main = new Elem({ tag: 'div', appendTo: row, addClass: 'event-main' });

		const isFuture = event.date && event.date > toDateOnly();
		const nameText = (isFuture ? '~ ' : '') + (event.name || meta.label);
		const nameEl = new Elem({ tag: 'div', appendTo: main, addClass: 'event-name', textContent: nameText });

		if (isFuture) nameEl.addClass('planned');

		const metaEl = new Elem({ tag: 'div', appendTo: main, addClass: 'event-meta' });

		if (field) new Elem({ tag: 'span', appendTo: metaEl, textContent: field.name || 'Unnamed Field' });

		new Elem({
			tag: 'span',
			appendTo: metaEl,
			textContent: formatDate(event.date, { month: 'numeric', day: 'numeric' }),
		});

		const d = details;

		if (event.category === 'harvest') {
			if (d.quantity && d.unit)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: colors.light(colors.yellow) },
					textContent: `${d.quantity} ${d.unit}`,
				});
			if (d.revenue)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: colors.light(colors.success) },
					textContent: `$${Number(d.revenue).toFixed(0)}`,
				});
		} else if (event.category === 'crop') {
			if (d.species)
				new Elem({ tag: 'span', appendTo: metaEl, textContent: d.variety ? `${d.species} — ${d.variety}` : d.species });
			if (d.seedingRate) new Elem({ tag: 'span', appendTo: metaEl, textContent: d.seedingRate });
		} else if (event.category === 'livestock') {
			if (d.headCount)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: colors.light(colors.orange) },
					textContent: `${d.headCount} hd`,
				});
			if (d.entryWeight) new Elem({ tag: 'span', appendTo: metaEl, textContent: `${d.entryWeight} lbs/hd` });
		} else if (event.category === 'cover_crop') {
			const mixLabel =
				Array.isArray(d.species) && d.species.length
					? d.species.map(s => `${s.name}${s.rate ? ` ${s.rate}${s.unit ? ' ' + s.unit : ''}` : ''}`).join(' + ')
					: d.seedMix || '';

			if (mixLabel) new Elem({ tag: 'span', appendTo: metaEl, textContent: mixLabel });

			if (d.terminationMethod)
				new Elem({ tag: 'span', appendTo: metaEl, textContent: `→ ${d.terminationMethod.replace(/_/g, ' ')}` });
		} else if (event.category === 'soil_test' && d.organicMatter) {
			new Elem({
				tag: 'span',
				appendTo: metaEl,
				style: { color: colors.light(colors.green) },
				textContent: `OM ${d.organicMatter}%`,
			});
			if (d.pH) new Elem({ tag: 'span', appendTo: metaEl, textContent: `pH ${d.pH}` });
		} else if (event.category === 'input' && d.product) {
			new Elem({ tag: 'span', appendTo: metaEl, textContent: `${d.product}${d.rate ? ` @ ${d.rate}` : ''}` });
		}

		if (event.notes)
			new Elem({ tag: 'span', appendTo: metaEl, style: { fontStyle: 'italic' }, textContent: event.notes });
	}

	_renderInsights() {
		this.content.empty();

		const fieldList = Object.values(this.fields?.body || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
		const allEvents = Object.values(this.events?.body || {});

		// Charts derived from Events data
		if (allEvents.length >= 2) {
			new SeasonCharts({
				appendTo: this.content,
				events: allEvents,
				fields: this.fields?.body || {},
				fieldFilter: this._fieldFilter || null,
				allEvents,
				allFields: this.fields?.body || {},
			});
		}

		if (!fieldList.length || !allEvents.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'chart-column',
				title: 'No data yet',
				message: 'Log events across multiple fields and seasons — patterns will appear here',
			});

			return;
		}

		const seasons = [...new Set(allEvents.map(e => e.season).filter(Boolean))].sort((a, b) => b - a).slice(0, 5);

		const tableWrap = new Component({
			appendTo: this.content,
			style: { overflowX: 'auto', marginTop: space.sm },
		});

		const table = new YieldTable({ appendTo: tableWrap });

		// Header row
		const thead = new Elem({ tag: 'thead', appendTo: table });
		const headerRow = new Elem({ tag: 'tr', appendTo: thead });

		new Elem({ tag: 'th', appendTo: headerRow, textContent: 'Field' });

		for (const season of seasons) new Elem({ tag: 'th', appendTo: headerRow, textContent: String(season) });

		const tbody = new Elem({ tag: 'tbody', appendTo: table });

		for (const field of fieldList) {
			const row = new Elem({ tag: 'tr', appendTo: tbody });

			const nameCell = new Elem({ tag: 'td', appendTo: row, addClass: 'field', textContent: field.name || 'Unnamed' });

			if (field.acreage) {
				new Elem({
					tag: 'div',
					appendTo: nameCell,
					addClass: 'acres',
					textContent: `${Number(field.acreage).toFixed(0)} ac`,
				});
			}

			for (const season of seasons) {
				const cell = new Elem({ tag: 'td', appendTo: row });

				const seasonEvents = allEvents.filter(e => e.fieldId === field.id && e.season === season);

				const cropEvent = seasonEvents.find(e => e.category === 'crop');
				const hasLivestock = seasonEvents.some(e => e.category === 'livestock');
				const hasCoverCrop = seasonEvents.some(e => e.category === 'cover_crop');
				const soilTest = seasonEvents.find(e => e.category === 'soil_test');

				if (cropEvent) {
					const details = this._parseDetails(cropEvent.details);

					if (details.yieldPerAcre) {
						new Elem({
							tag: 'div',
							appendTo: cell,
							addClass: 'yield',
							textContent: `${details.yieldPerAcre} ${details.yieldUnit || 'bu'}`,
						});

						new Elem({
							tag: 'div',
							appendTo: cell,
							addClass: 'crop',
							textContent: details.species || cropEvent.name,
						});
					} else {
						new Elem({
							tag: 'div',
							appendTo: cell,
							addClass: 'crop-only',
							textContent: this._parseDetails(cropEvent.details).species || cropEvent.name,
						});
					}
				}

				if (hasLivestock || hasCoverCrop || soilTest) {
					const badges = new Elem({ tag: 'div', appendTo: cell, addClass: 'badges' });

					if (hasLivestock) {
						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: 'Livestock' },
							textContent: categoryMeta('livestock').emoji,
						});
					}

					if (hasCoverCrop) {
						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: 'Cover crop' },
							textContent: categoryMeta('cover_crop').emoji,
						});
					}

					if (soilTest) {
						const d = this._parseDetails(soilTest.details);

						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: `Soil test${d.organicMatter ? ` — OM ${d.organicMatter}%` : ''}` },
							textContent: '🔬',
						});
					}
				}

				if (!seasonEvents.length) {
					cell.addClass('empty');
					cell.elem.title = `Log event for ${field.name} — ${season}`;
					cell.elem.textContent = '+ add';
					cell.onPointerPress(() => this._openEventDialog(null, field.id));
				}
			}
		}

		new Footnote({
			appendTo: this.content,
			textContent:
				'Fields with 🐄 and 🌱 alongside yield data show whether regenerative practices correlate with yield changes over time.',
		});
	}

	_parseDetails(details) {
		return details || {};
	}

	_openEventDialog(event = null, fieldId = null) {
		new EventDialog({
			event: event || undefined,
			fieldId: fieldId || undefined,
			onSave: async data => {
				const result = event
					? await updateEvent(event.id, { body: { ...data, _v: event._v } })
					: await createEvent({ body: data });

				if (result?.status === 'success' && result.body && this.events?.body) {
					this.events.body[event?.id ?? result.body.id] = result.body;
					this._renderCurrent();
				}

				return result;
			},
			onDelete: event
				? async () => {
						const result = await deleteEvent(event.id);

						if (result?.status !== 'success') return result;

						if (this.events?.body) delete this.events.body[event.id];
						this._renderCurrent();

						return result;
					}
				: undefined,
		});
	}
}
