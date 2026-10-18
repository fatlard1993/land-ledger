import { Button, Component, Elem, Icon, formatDate, styled } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getEvents, getFields, createEvent, updateEvent, deleteEvent, getWeather, getCountyYield } from '../api';
import { centroidFromGeometry } from '../geo';
import { PageView, PageToolbar, PageTitle, EmptyState } from '../Layout';
import context from '../context';
import SeasonCharts from '../Charts/SeasonCharts';

import TabularImportDialog from '../Import/TabularImportDialog';
import ExportDialog from '../Export/ExportDialog';
import EventDialog, { categoryMeta, eventEmoji } from './EventDialog';

const CURRENT_YEAR = new Date().getFullYear();

const EventRow = styled(
	Component,
	({ colors }) => `
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid ${colors.dark(colors.gray)};
		cursor: pointer;
		transition: background 0.1s;

		&:hover {
			background: rgba(255,255,255,0.03);
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
			margin-top: 2px;
		}

		& .event-main {
			flex: 1;
			min-width: 0;
		}

		& .event-name {
			font-size: 14px;
			font-weight: 600;
			color: #fff;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		& .event-meta {
			font-size: 12px;
			color: rgba(255,255,255,0.45);
			margin-top: 1px;
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
	`,
);

styled(
	Component,
	({ colors }) => `
		padding: 6px 8px;
		font-size: 12px;
		border-right: 1px solid ${colors.dark(colors.gray)};
		text-align: center;
		vertical-align: top;

		& .yield {
			color: #fff;
			font-weight: 600;
		}

		& .badges {
			display: flex;
			gap: 3px;
			justify-content: center;
			margin-top: 3px;
			flex-wrap: wrap;
		}
	`,
);

export default class Timeline extends AsyncView {
	_view = 'timeline'; // 'timeline' | 'insights'
	_fieldFilter = null;

	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });

		this._titleElem = new PageTitle({ appendTo: this.toolbar, textContent: 'Timeline' });

		const viewToggle = new Component({ appendTo: this.toolbar, style: { display: 'flex', gap: '4px' } });

		this._timelineBtn = new Button({
			appendTo: viewToggle,
			textContent: 'Log',
			style: { fontSize: '12px', padding: '4px 10px' },
			onPointerPress: () => this._switchView('timeline'),
		});

		this._insightsBtn = new Button({
			appendTo: viewToggle,
			textContent: 'Insights',
			style: { fontSize: '12px', padding: '4px 10px' },
			onPointerPress: () => this._switchView('insights'),
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
		const [events, fields] = await Promise.all([
			this._sub(
				getEvents({
					onRefetch: response => {
						this.events = response;
						this._renderCurrent();
					},
				}),
			),
			this._sub(
				getFields({
					onRefetch: response => {
						this.fields = response;
						this._renderCurrent();
					},
				}),
			),
		]);

		this.events = events;
		this.fields = fields;

		this._subsCleanup();

		// Check if navigated here with a field filter (e.g. from FieldPanel)
		if (context.timelineFieldFilter) {
			this._fieldFilter = context.timelineFieldFilter;
			context.timelineFieldFilter = null;
			const filterField = this.fields?.body?.[this._fieldFilter];

			if (filterField) this._titleElem.elem.textContent = filterField.name;
		}

		this._switchView('timeline');
	}

	_switchView(view) {
		this._view = view;
		this._timelineBtn.elem.style.background = view === 'timeline' ? 'rgba(255,255,255,0.15)' : '';
		this._insightsBtn.elem.style.background = view === 'insights' ? 'rgba(255,255,255,0.15)' : '';
		this._renderCurrent();
	}

	_renderCurrent() {
		if (this._view === 'insights') this._renderInsights();
		else this._renderTimeline();
	}

	_renderFilterBar() {
		const fieldList = Object.values(this.fields?.body || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		if (!fieldList.length) return;

		const bar = new Component({
			appendTo: this.content,
			style: { display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' },
		});

		const filterSelect = new Elem({
			tag: 'select',
			appendTo: bar,
			style: {
				background: 'rgba(255,255,255,0.07)',
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: '4px',
				color: '#fff',
				fontSize: '13px',
				padding: '5px 8px',
				fontFamily: 'inherit',
				cursor: 'pointer',
				flex: '1',
			},
		});

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

			this._titleElem.elem.textContent = selectedField ? selectedField.name : 'Timeline';
			this._renderTimeline();
		});

		if (this._fieldFilter) {
			new Button({
				appendTo: bar,
				textContent: '✕ Clear',
				style: { fontSize: '12px', padding: '4px 8px' },
				onPointerPress: () => {
					this._fieldFilter = null;
					this._titleElem.elem.textContent = 'Timeline';
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
				if (this._fieldFilter) return new Date(a.date) - new Date(b.date);
				return new Date(b.date) - new Date(a.date);
			});

		if (!allEvents.length) {
			const empty = new EmptyState({ appendTo: this.content });

			new Elem({ tag: 'div', appendTo: empty, addClass: 'empty-icon', textContent: '📅' });
			new Elem({ tag: 'div', appendTo: empty, addClass: 'empty-title', textContent: 'No events logged yet' });
			new Elem({
				tag: 'div',
				appendTo: empty,
				addClass: 'empty-subtitle',
				textContent: 'Log crops, livestock, cover crops, inputs, and soil tests — tap + to start',
			});

			return;
		}

		let lastSeason = null;
		const field = this._fieldFilter ? this.fields?.body?.[this._fieldFilter] : null;

		for (const event of allEvents) {
			const season = event.season || new Date(event.date).getFullYear() || CURRENT_YEAR;

			if (season !== lastSeason) {
				const seasonHeader = new Component({
					appendTo: this.content,
					style: { display: 'flex', alignItems: 'baseline', gap: '10px', padding: '14px 0 4px' },
				});

				new Elem({
					tag: 'span',
					appendTo: seasonHeader,
					style: {
						fontSize: '12px',
						textTransform: 'uppercase',
						letterSpacing: '0.08em',
						color: 'rgba(255,255,255,0.35)',
					},
					textContent: String(season),
				});

				// Weather + county benchmark — only when filtering by a specific field
				if (field?.geometry && season <= CURRENT_YEAR) {
					const weatherSlot = new Elem({
						tag: 'span',
						appendTo: seasonHeader,
						style: { fontSize: '11px', color: 'rgba(255,255,255,0.25)' },
						textContent: '…',
					});

					this._loadSeasonWeather(season, field, weatherSlot);

					// County yield benchmark — if field has state/county and a harvest event exists
					const harvestEvents = allEvents.filter(
						e =>
							e.fieldId === field.id &&
							(e.season === season || new Date(e.date + 'T12:00:00').getFullYear() === season) &&
							e.category === 'harvest',
					);

					if (field.state && field.county && harvestEvents.length) {
						const benchmarkSlot = new Elem({
							tag: 'span',
							appendTo: seasonHeader,
							style: { fontSize: '11px', color: 'rgba(255,255,255,0.25)' },
						});
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
		const today = new Date().toISOString().slice(0, 10);
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
			const m = new Date(d + 'T12:00:00').getMonth();
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
			if (delta >= 5) color = '#4caf50';
			else if (delta <= -5) color = '#e05252';
			else color = 'rgba(255,255,255,0.6)';
			const text = `County avg ${countyAvg.toFixed(1)} ${unit}  ·  ${sign}${delta.toFixed(0)}% vs avg`;

			slot.elem.textContent = text;
			slot.elem.style.color = color;
		} else {
			// No farm yield recorded — show county average as reference only
			slot.elem.textContent = `County avg: ${countyAvg.toFixed(1)} ${unit}`;
			slot.elem.style.color = 'rgba(255,255,255,0.35)';
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

		dot.elem.style.background = `${meta.color}22`;
		dot.elem.style.border = `1px solid ${meta.color}55`;
		dot.elem.textContent = eventEmoji(event);

		const main = new Elem({ tag: 'div', appendTo: row, addClass: 'event-main' });

		const isFuture = event.date && event.date > new Date().toISOString().slice(0, 10);
		const nameText = (isFuture ? '~ ' : '') + (event.name || meta.label);
		const nameEl = new Elem({ tag: 'div', appendTo: main, addClass: 'event-name', textContent: nameText });

		if (isFuture) nameEl.elem.style.color = 'rgba(255,255,255,0.65)';

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
					style: { color: '#c8a84b' },
					textContent: `${d.quantity} ${d.unit}`,
				});
			if (d.revenue)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: '#4caf50' },
					textContent: `$${Number(d.revenue).toFixed(0)}`,
				});
		} else if (event.category === 'crop') {
			if (d.species)
				new Elem({ tag: 'span', appendTo: metaEl, textContent: d.variety ? `${d.species} — ${d.variety}` : d.species });
			if (d.seedingRate)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: 'rgba(255,255,255,0.4)' },
					textContent: d.seedingRate,
				});
		} else if (event.category === 'livestock') {
			if (d.headCount)
				new Elem({ tag: 'span', appendTo: metaEl, style: { color: '#a0522d' }, textContent: `${d.headCount} hd` });
			if (d.entryWeight) new Elem({ tag: 'span', appendTo: metaEl, textContent: `${d.entryWeight} lbs/hd` });
		} else if (event.category === 'cover_crop') {
			const mixLabel =
				Array.isArray(d.species) && d.species.length
					? d.species.map(s => `${s.name}${s.rate ? ` ${s.rate}${s.unit ? ' ' + s.unit : ''}` : ''}`).join(' + ')
					: d.seedMix || '';

			if (mixLabel) new Elem({ tag: 'span', appendTo: metaEl, textContent: mixLabel });

			if (d.terminationMethod)
				new Elem({
					tag: 'span',
					appendTo: metaEl,
					style: { color: 'rgba(255,255,255,0.3)' },
					textContent: `→ ${d.terminationMethod.replace(/_/g, ' ')}`,
				});
		} else if (event.category === 'soil_test' && d.organicMatter) {
			new Elem({ tag: 'span', appendTo: metaEl, style: { color: '#4caf50' }, textContent: `OM ${d.organicMatter}%` });
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
			const empty = new EmptyState({ appendTo: this.content });

			new Elem({ tag: 'div', appendTo: empty, addClass: 'empty-icon', textContent: '📊' });
			new Elem({ tag: 'div', appendTo: empty, addClass: 'empty-title', textContent: 'No data yet' });
			new Elem({
				tag: 'div',
				appendTo: empty,
				addClass: 'empty-subtitle',
				textContent: 'Log events across multiple fields and seasons — patterns will appear here',
			});

			return;
		}

		const seasons = [...new Set(allEvents.map(e => e.season).filter(Boolean))].sort((a, b) => b - a).slice(0, 5);

		const tableWrap = new Component({
			appendTo: this.content,
			style: { overflowX: 'auto', marginTop: '8px' },
		});

		const table = new Elem({ tag: 'table', appendTo: tableWrap });

		table.elem.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';

		// Header row
		const thead = new Elem({ tag: 'thead', appendTo: table });
		const headerRow = new Elem({ tag: 'tr', appendTo: thead });

		new Elem({
			tag: 'th',
			appendTo: headerRow,
			style: {
				textAlign: 'left',
				padding: '6px 8px',
				color: 'rgba(255,255,255,0.45)',
				fontWeight: '600',
				borderBottom: '2px solid rgba(255,255,255,0.1)',
				whiteSpace: 'nowrap',
			},
			textContent: 'Field',
		});

		for (const season of seasons) {
			new Elem({
				tag: 'th',
				appendTo: headerRow,
				style: {
					padding: '6px 8px',
					color: 'rgba(255,255,255,0.45)',
					fontWeight: '600',
					borderBottom: '2px solid rgba(255,255,255,0.1)',
					textAlign: 'center',
					whiteSpace: 'nowrap',
				},
				textContent: String(season),
			});
		}

		const tbody = new Elem({ tag: 'tbody', appendTo: table });

		for (const field of fieldList) {
			const row = new Elem({ tag: 'tr', appendTo: tbody });

			const nameCell = new Elem({ tag: 'td', appendTo: row });

			nameCell.elem.style.cssText =
				'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.07);white-space:nowrap;font-weight:600;';
			nameCell.elem.textContent = field.name || 'Unnamed';

			if (field.acreage) {
				new Elem({
					tag: 'div',
					appendTo: nameCell,
					style: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '400' },
					textContent: `${Number(field.acreage).toFixed(0)} ac`,
				});
			}

			for (const season of seasons) {
				const cell = new Elem({ tag: 'td', appendTo: row });

				cell.elem.style.cssText =
					'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.07);text-align:center;vertical-align:top;';

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
							style: { color: '#fff', fontWeight: '600' },
							textContent: `${details.yieldPerAcre} ${details.yieldUnit || 'bu'}`,
						});

						new Elem({
							tag: 'div',
							appendTo: cell,
							style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)' },
							textContent: details.species || cropEvent.name,
						});
					} else {
						new Elem({
							tag: 'div',
							appendTo: cell,
							style: { fontSize: '11px', color: 'rgba(255,255,255,0.6)' },
							textContent: this._parseDetails(cropEvent.details).species || cropEvent.name,
						});
					}
				}

				if (hasLivestock || hasCoverCrop || soilTest) {
					const badges = new Elem({
						tag: 'div',
						appendTo: cell,
						style: { display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '3px', flexWrap: 'wrap' },
					});

					if (hasLivestock) {
						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: 'Livestock' },
							style: { fontSize: '12px', cursor: 'default' },
							textContent: '🐄',
						});
					}

					if (hasCoverCrop) {
						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: 'Cover crop' },
							style: { fontSize: '12px', cursor: 'default' },
							textContent: '🌱',
						});
					}

					if (soilTest) {
						const d = this._parseDetails(soilTest.details);

						new Elem({
							tag: 'span',
							appendTo: badges,
							attributes: { title: `Soil test${d.organicMatter ? ` — OM ${d.organicMatter}%` : ''}` },
							style: { fontSize: '12px', cursor: 'default' },
							textContent: '🔬',
						});
					}
				}

				if (!seasonEvents.length) {
					cell.elem.style.cssText += 'cursor:pointer;color:rgba(255,255,255,0.18);font-size:10px;';
					cell.elem.title = `Log event for ${field.name} — ${season}`;
					cell.elem.textContent = '+ add';
					cell.onPointerPress(() => this._openEventDialog(null, field.id));
				}
			}
		}

		new Elem({
			tag: 'p',
			appendTo: this.content,
			style: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '12px', lineHeight: '1.6' },
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
