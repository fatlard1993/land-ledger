import { Chart, registerables } from 'chart.js';
import { Component, Elem, styled } from '@vanilla-bean/components';

import {
	soilDataByField,
	yieldDataByField,
	economicsByField,
	practicesByFieldYear,
	allYears,
	FIELD_COLORS,
} from './chartData';

Chart.register(...registerables);

const isPreSeason = p => p.timing !== 'post-harvest' && p.timing !== 'fall';

const CHART_OPTS = {
	color: 'rgba(255,255,255,0.7)',
	scales: {
		x: {
			ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
			grid: { color: 'rgba(255,255,255,0.06)' },
			border: { color: 'rgba(255,255,255,0.1)' },
		},
		y: {
			ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
			grid: { color: 'rgba(255,255,255,0.06)' },
			border: { color: 'rgba(255,255,255,0.1)' },
		},
	},
	plugins: {
		legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 }, boxWidth: 12, padding: 10 } },
		tooltip: {
			backgroundColor: 'rgba(20,20,20,0.95)',
			titleColor: '#fff',
			bodyColor: 'rgba(255,255,255,0.7)',
			borderColor: 'rgba(255,255,255,0.15)',
			borderWidth: 1,
		},
	},
	maintainAspectRatio: false,
	animation: { duration: 300 },
};

const ChartWrap = styled(
	Component,
	({ colors }) => `
		background: ${colors.darker(colors.gray)};
		border: 1px solid ${colors.dark(colors.gray)};
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 12px;

		& .chart-title {
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.07em;
			color: rgba(255,255,255,0.4);
			margin-bottom: 8px;
		}
	`,
);

const makeCanvas = (appendTo, height = 200) => {
	const wrap = new Elem({ tag: 'div', appendTo, style: { position: 'relative', height: `${height}px` } });
	const canvas = document.createElement('canvas');

	canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
	wrap.elem.append(canvas);

	return canvas;
};

export default class SeasonCharts extends Component {
	constructor(options = {}) {
		super(options);

		this._charts = [];
	}

	build() {
		this._renderCharts();
	}

	_renderCharts() {
		this.empty();
		this._destroyAll();

		const { events = [], fields = {}, fieldFilter = null, allEvents = null, allFields = {} } = this.options;

		if (!events.length) return;

		const filtered = fieldFilter ? events.filter(e => e.fieldId === fieldFilter) : events;
		const years = allYears(filtered);

		if (years.length < 2) {
			new Elem({
				tag: 'p',
				appendTo: this,
				style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px 0' },
				textContent: 'Need data from at least 2 seasons to show trends',
			});

			return;
		}

		const soilData = soilDataByField(filtered);
		const yieldData = yieldDataByField(filtered);
		const econData = economicsByField(filtered);
		const practices = practicesByFieldYear(filtered);

		const fieldIds = fieldFilter ? [fieldFilter] : Object.keys(fields);

		const hasOM = fieldIds.some(id => soilData[id]?.some(d => d.organicMatter != null));
		const hasResp = fieldIds.some(id => soilData[id]?.some(d => d.soilRespiration != null));
		const hasYield = fieldIds.some(id => yieldData[id]?.length > 0);
		const hasEcon = fieldIds.some(id => econData[id]?.length > 0);

		if (hasOM)
			this._renderSoilMetricChart(fieldIds, soilData, fields, years, practices, fieldFilter, {
				title: 'Organic Matter % over time',
				yLabel: 'OM %',
				key: 'organicMatter',
				singleLabel: 'Pre-season OM%',
				splitPostHarvest: true,
			});
		if (hasResp)
			this._renderSoilMetricChart(fieldIds, soilData, fields, years, practices, fieldFilter, {
				title: 'Soil Respiration over time (mg CO₂/g)',
				yLabel: 'mg CO₂/g',
				key: 'soilRespiration',
				singleLabel: 'Respiration',
				beginAtZero: true,
			});
		if (hasYield) this._renderYieldChart(fieldIds, yieldData, fields, years, practices, fieldFilter);
		if (hasEcon && fieldFilter) this._renderEconChart(fieldFilter, econData, fields, years);

		// Trial comparison — shown when viewing a specific field that has a paired trial field
		if (fieldFilter && allEvents) {
			const thisField = allFields[fieldFilter] || fields[fieldFilter];
			if (thisField?.trialGroup && thisField?.trialRole) {
				const pairedField = Object.values(allFields).find(
					f =>
						f.id !== fieldFilter &&
						f.trialGroup === thisField.trialGroup &&
						f.trialRole &&
						f.trialRole !== thisField.trialRole,
				);
				if (pairedField) {
					const pairedEvents = allEvents.filter(e => e.fieldId === pairedField.id);
					const [treatField, ctrlField, treatEvents, ctrlEvents] =
						thisField.trialRole === 'treatment'
							? [thisField, pairedField, filtered, pairedEvents]
							: [pairedField, thisField, pairedEvents, filtered];
					this._renderTrialComparison(treatField, ctrlField, treatEvents, ctrlEvents);
				}
			}
		}
	}

	_renderSoilMetricChart(
		fieldIds,
		soilData,
		fields,
		years,
		practices,
		fieldFilter,
		{ title, yLabel, key, singleLabel, splitPostHarvest = false, beginAtZero = false },
	) {
		const wrap = new ChartWrap({ appendTo: this });

		new Elem({ tag: 'div', appendTo: wrap, addClass: 'chart-title', textContent: title });

		const canvas = makeCanvas(wrap, fieldFilter ? 220 : 200);
		const datasets = [];

		fieldIds.forEach((fieldId, i) => {
			const points = soilData[fieldId];

			if (!points?.some(p => p[key] != null)) return;

			const color = FIELD_COLORS[i % FIELD_COLORS.length];
			const label = fields[fieldId]?.name || 'Field';

			const preData = years.map(y => points.find(p => p.year === y && isPreSeason(p))?.[key] ?? null);

			if (preData.some(v => v != null)) {
				datasets.push({
					label: fieldFilter ? singleLabel : label,
					data: preData,
					borderColor: color,
					backgroundColor: `${color}22`,
					tension: 0.3,
					pointRadius: 5,
					pointHoverRadius: 7,
					fill: false,
				});
			}

			if (splitPostHarvest && fieldFilter) {
				const postData = years.map(y => points.find(p => p.year === y && !isPreSeason(p))?.[key] ?? null);

				if (postData.some(v => v != null)) {
					datasets.push({
						label: `Post-harvest ${singleLabel}`,
						data: postData,
						borderColor: '#4caf50',
						backgroundColor: '#4caf5022',
						borderDash: [4, 3],
						tension: 0.3,
						pointRadius: 5,
						fill: false,
					});
				}
			}
		});

		if (!datasets.length) {
			wrap.elem.remove();
			return;
		}

		const xLabels = fieldFilter
			? years.map(y => {
					const p = practices[fieldFilter]?.[y] || {};
					const icons = [p.livestock && '🐄', p.coverCrop && '🌱'].filter(Boolean).join('');

					return icons ? `${y}\n${icons}` : String(y);
				})
			: years.map(String);

		const chart = new Chart(canvas, {
			type: 'line',
			data: { labels: xLabels, datasets },
			options: {
				...CHART_OPTS,
				scales: {
					...CHART_OPTS.scales,
					y: {
						...CHART_OPTS.scales.y,
						title: { display: true, text: yLabel, color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
						...(beginAtZero && { beginAtZero: true }),
					},
				},
			},
		});

		this._charts.push(chart);
	}

	_renderTrialComparison(treatmentField, controlField, treatmentEvents, controlEvents) {
		const bothSoil = soilDataByField([...treatmentEvents, ...controlEvents]);
		const treatmentPoints = bothSoil[treatmentField.id] || [];
		const controlPoints = bothSoil[controlField.id] || [];
		const years = [...new Set([...treatmentPoints, ...controlPoints].map(p => p.year))].sort((a, b) => a - b);

		if (years.length < 2) return;

		const hasOM =
			treatmentPoints.some(p => p.organicMatter != null) || controlPoints.some(p => p.organicMatter != null);
		const hasResp =
			treatmentPoints.some(p => p.soilRespiration != null) || controlPoints.some(p => p.soilRespiration != null);

		if (!hasOM && !hasResp) return;

		const wrap = new ChartWrap({ appendTo: this });
		const roleLabel = r => (r === 'treatment' ? 'Treatment' : 'Control');

		new Elem({
			tag: 'div',
			appendTo: wrap,
			addClass: 'chart-title',
			textContent: `Trial Comparison — ${treatmentField.trialGroup}`,
		});

		const renderMetric = (title, yAxisLabel, extractFn) => {
			const tData = years.map(y => {
				const pt = treatmentPoints.find(p => p.year === y && isPreSeason(p));

				return extractFn(pt);
			});
			const cData = years.map(y => {
				const pt = controlPoints.find(p => p.year === y && isPreSeason(p));

				return extractFn(pt);
			});

			if (!tData.some(v => v != null) && !cData.some(v => v != null)) return;

			new Elem({
				tag: 'div',
				appendTo: wrap,
				style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', marginTop: '8px' },
				textContent: title,
			});

			const canvas = makeCanvas(wrap, 180);
			const datasets = [];

			if (tData.some(v => v != null)) {
				datasets.push({
					label: `${roleLabel(treatmentField.trialRole)} — ${treatmentField.name}`,
					data: tData,
					borderColor: '#4caf50',
					backgroundColor: '#4caf5022',
					tension: 0.3,
					pointRadius: 5,
					fill: false,
				});
			}

			if (cData.some(v => v != null)) {
				datasets.push({
					label: `${roleLabel(controlField.trialRole)} — ${controlField.name}`,
					data: cData,
					borderColor: '#9e9e9e',
					backgroundColor: '#9e9e9e22',
					borderDash: [5, 4],
					tension: 0.3,
					pointRadius: 5,
					fill: false,
				});
			}

			const chart = new Chart(canvas, {
				type: 'line',
				data: { labels: years.map(String), datasets },
				options: {
					...CHART_OPTS,
					scales: {
						...CHART_OPTS.scales,
						y: {
							...CHART_OPTS.scales.y,
							title: { display: true, text: yAxisLabel, color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
						},
					},
				},
			});

			this._charts.push(chart);
		};

		if (hasOM) renderMetric('Organic Matter %', 'OM %', pt => pt?.organicMatter ?? null);
		if (hasResp) renderMetric('Soil Respiration', 'mg CO₂/g', pt => pt?.soilRespiration ?? null);
	}

	_renderYieldChart(fieldIds, yieldData, fields, years, practices, fieldFilter) {
		const wrap = new ChartWrap({ appendTo: this });

		new Elem({ tag: 'div', appendTo: wrap, addClass: 'chart-title', textContent: 'Yield per acre over time' });

		const canvas = makeCanvas(wrap, fieldFilter ? 220 : 200);
		const datasets = [];

		fieldIds.forEach((fieldId, i) => {
			const points = yieldData[fieldId];

			if (!points?.length) return;

			const color = FIELD_COLORS[i % FIELD_COLORS.length];
			const label = fieldFilter ? points[0]?.crop || 'Crop' : fields[fieldId]?.name || 'Field';

			const data = years.map(y => {
				const pt = points.find(p => p.year === y);

				return pt?.yieldPerAcre ?? null;
			});

			if (data.some(v => v != null)) {
				datasets.push({
					label,
					data,
					borderColor: color,
					backgroundColor: `${color}33`,
					tension: 0.3,
					pointRadius: 5,
					fill: fieldFilter,
				});
			}
		});

		if (!datasets.length) {
			wrap.elem.remove();
			return;
		}

		const practiceLabelsX = fieldFilter
			? years.map(y => {
					const p = practices[fieldFilter]?.[y] || {};
					const icons = [p.livestock && '🐄', p.coverCrop && '🌱'].filter(Boolean).join('');

					return icons ? `${y}\n${icons}` : String(y);
				})
			: years.map(String);

		const chart = new Chart(canvas, {
			type: 'line',
			data: { labels: practiceLabelsX, datasets },
			options: {
				...CHART_OPTS,
				scales: {
					...CHART_OPTS.scales,
					y: {
						...CHART_OPTS.scales.y,
						title: { display: true, text: 'bu/ac (or equiv)', color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
						beginAtZero: false,
					},
				},
			},
		});

		this._charts.push(chart);
	}

	_renderEconChart(fieldId, econData, fields, years) {
		const points = econData[fieldId];

		if (!points?.length) return;

		const wrap = new ChartWrap({ appendTo: this });

		new Elem({ tag: 'div', appendTo: wrap, addClass: 'chart-title', textContent: 'Input cost vs. revenue ($/ac)' });

		const canvas = makeCanvas(wrap, 220);

		const inputCosts = years.map(y => points.find(p => p.year === y)?.inputCost || null);
		const revenues = years.map(y => points.find(p => p.year === y)?.revenue || null);

		const datasets = [];

		if (inputCosts.some(v => v))
			datasets.push({
				label: 'Input cost',
				data: inputCosts,
				backgroundColor: '#e8c42a55',
				borderColor: '#e8c42a',
				borderWidth: 2,
				type: 'bar',
			});
		if (revenues.some(v => v))
			datasets.push({
				label: 'Revenue',
				data: revenues,
				backgroundColor: '#4caf5055',
				borderColor: '#4caf50',
				borderWidth: 2,
				type: 'bar',
			});

		// Net P/L line
		const hasRev = revenues.some(v => v);
		const hasCost = inputCosts.some(v => v);

		if (hasRev && hasCost) {
			const net = years.map(y => {
				const p = points.find(d => d.year === y);

				if (!p) return null;

				return (p.revenue || 0) - (p.inputCost || 0);
			});

			datasets.push({
				label: 'Net P/L',
				data: net,
				borderColor: '#fff',
				backgroundColor: 'transparent',
				borderWidth: 1.5,
				tension: 0.3,
				pointRadius: 4,
				type: 'line',
			});
		}

		if (!datasets.length) {
			wrap.elem.remove();
			return;
		}

		const chart = new Chart(canvas, {
			type: 'bar',
			data: { labels: years.map(String), datasets },
			options: {
				...CHART_OPTS,
				scales: {
					...CHART_OPTS.scales,
					y: {
						...CHART_OPTS.scales.y,
						title: { display: true, text: '$/ac', color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
					},
				},
			},
		});

		this._charts.push(chart);
	}

	_destroyAll() {
		for (const chart of this._charts || []) {
			try {
				chart.destroy();
			} catch {}
		}

		this._charts = [];
	}

	static handlers = {
		events() {
			if (this.rendered) this._renderCharts();
		},
		fieldFilter() {
			if (this.rendered) this._renderCharts();
		},
		allEvents() {
			if (this.rendered) this._renderCharts();
		},
		allFields() {
			if (this.rendered) this._renderCharts();
		},
	};
}
