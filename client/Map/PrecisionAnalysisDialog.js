import { Card, Component, Dialog, Elem, EmptyState, Icon, styled, theme } from '@vanilla-bean/components';
import Chart from 'chart.js/auto';
import { analyzePrecisionLayers } from '../api/precisionLayers';
import { FigureTable, SubLabel } from './panelParts';

const { colors } = theme;

// Chart.js reads its colors as CSS text
const css = color => color.toRgbString();

const Footnote = styled(
	Component,
	({ colors }) => `
		margin-top: 8px;
		font-size: 10px;
		line-height: 1.5;
		color: ${colors.gray};
	`,
);

const formatN = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—');

// Plain-language interpretation of the Pearson correlation
function interpretR(r) {
	if (r === null) return 'Insufficient data for correlation.';
	const abs = Math.abs(r);
	const dir = r >= 0 ? 'positive' : 'negative';
	if (abs >= 0.7)
		return `Strong ${dir} correlation (r = ${r.toFixed(2)}) — applied rate strongly predicts yield at this field.`;
	if (abs >= 0.4) return `Moderate ${dir} correlation (r = ${r.toFixed(2)}) — applied rate has some predictive value.`;
	if (abs >= 0.2)
		return `Weak ${dir} correlation (r = ${r.toFixed(2)}) — rate had limited effect on yield. Other factors dominated.`;
	return `No meaningful correlation (r = ${r.toFixed(2)}) — yield variability was driven by something other than rate.`;
}

export default class PrecisionAnalysisDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Layer Correlation Analysis',
			buttons: ['Close'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._chart = null;
		this.addCleanup('chart', () => this._chart?.destroy());
		this._run(options.appliedLayer, options.yieldLayer);
	}

	async _run(appliedLayer, yieldLayer) {
		this.body.empty();

		new EmptyState({
			appendTo: this.body,
			loading: true,
			message: `Joining ${appliedLayer.label} → ${yieldLayer.label}…`,
		});

		let result;
		try {
			result = await analyzePrecisionLayers({
				appliedLayerId: appliedLayer.id,
				yieldLayerId: yieldLayer.id,
			});
		} catch (err) {
			this.body.empty();
			new Component({
				appendTo: this.body,
				style: { color: colors.light(colors.danger), fontSize: '13px' },
				textContent: err.message || 'Analysis failed',
			});
			return;
		}

		this.body.empty();
		this._render(result, appliedLayer, yieldLayer);
	}

	_render(r, appliedLayer, yieldLayer) {
		const body = this.body;

		// ── Summary header ───────────────────────────────────────────────────────
		const summary = new Card({ appendTo: body, style: { marginBottom: '14px' } });

		new Component({
			appendTo: summary,
			style: { fontSize: '13px', fontWeight: '600', marginBottom: '4px' },
			textContent: `${r.pairCount.toLocaleString()} matched point pairs across field`,
		});
		new Component({
			appendTo: summary,
			style: { fontSize: '12px', color: colors.muted, lineHeight: '1.5' },
			textContent: interpretR(r.pearsonR),
		});

		// Best zone callout
		if (r.bestZone) {
			const best = r.bestZone;
			new Component({
				appendTo: summary,
				style: { fontSize: '12px', color: colors.light(colors.success), marginTop: '6px', fontWeight: '500' },
				textContent: `Highest yield at zone ${best.zoneIndex}: avg rate ${formatN(best.appliedMean, 0)} ${appliedLayer.valueUnit ?? ''} → ${formatN(best.yieldMean)} ${yieldLayer.valueUnit ?? ''}`,
			});
		}

		// ── Scatter plot ─────────────────────────────────────────────────────────
		new SubLabel({ appendTo: body, textContent: 'Rate vs Yield' });

		const canvasWrap = new Component({
			appendTo: body,
			style: { position: 'relative', height: '220px', marginBottom: '14px' },
		});
		const canvas = document.createElement('canvas');
		canvasWrap.elem.append(canvas);

		// Build trend line across the scatter range
		const xVals = r.scatter.map(p => p.x);
		const xMin = Math.min(...xVals);
		const xMax = Math.max(...xVals);
		const trendLine = [
			{ x: xMin, y: r.regression.slope * xMin + r.regression.intercept },
			{ x: xMax, y: r.regression.slope * xMax + r.regression.intercept },
		];

		if (this._chart) this._chart.destroy();
		this._chart = new Chart(canvas, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Rate vs Yield',
						data: r.scatter,
						backgroundColor: css(colors.alpha(colors.info, 0.35)),
						pointRadius: 3,
						order: 2,
					},
					{
						label: 'Trend',
						type: 'line',
						data: trendLine,
						borderColor: css(colors.alpha(colors.warning, 0.8)),
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						order: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: ctx =>
								`${formatN(ctx.parsed.x, 0)} ${appliedLayer.valueUnit ?? ''} → ${formatN(ctx.parsed.y)} ${yieldLayer.valueUnit ?? ''}`,
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: `Applied rate (${appliedLayer.valueUnit ?? ''})`,
							color: css(colors.gray),
							font: { size: 11 },
						},
						grid: { color: css(colors.border) },
						ticks: { color: css(colors.gray), font: { size: 10 } },
					},
					y: {
						title: {
							display: true,
							text: `Yield (${yieldLayer.valueUnit ?? ''})`,
							color: css(colors.gray),
							font: { size: 11 },
						},
						grid: { color: css(colors.border) },
						ticks: { color: css(colors.gray), font: { size: 10 } },
					},
				},
			},
		});

		// ── Zone breakdown ───────────────────────────────────────────────────────
		new SubLabel({ appendTo: body, textContent: 'Zones by applied rate' });

		const table = new FigureTable({ appendTo: body });

		const thead = new Elem({ tag: 'thead', appendTo: table });
		const hRow = new Elem({ tag: 'tr', appendTo: thead });
		for (const [text, align] of [
			['Zone', 'left'],
			['Rate range', 'right'],
			['Avg rate', 'right'],
			['Avg yield', 'right'],
			['Points', 'right'],
		]) {
			new Elem({ tag: 'th', appendTo: hRow, ...(align === 'right' && { addClass: 'number' }), textContent: text });
		}

		const tbody = new Elem({ tag: 'tbody', appendTo: table });
		const bestYield = Math.max(...r.zones.map(z => z.yieldMean));

		for (const zone of r.zones) {
			const tr = new Elem({ tag: 'tr', appendTo: tbody });
			const isBest = zone.yieldMean === bestYield;
			const cells = [
				zone.zoneIndex,
				`${formatN(zone.appliedMin, 0)}–${formatN(zone.appliedMax, 0)} ${appliedLayer.valueUnit ?? ''}`,
				`${formatN(zone.appliedMean, 0)} ${appliedLayer.valueUnit ?? ''}`,
				`${formatN(zone.yieldMean)} ${yieldLayer.valueUnit ?? ''}`,
				zone.count.toLocaleString(),
			];

			cells.forEach((text, i) => {
				const best = isBest && i === 3;

				const td = new Elem({
					tag: 'td',
					appendTo: tr,
					...(i !== 0 && { addClass: 'number' }),
					style: best ? { color: colors.light(colors.success), fontWeight: '700' } : {},
					textContent: String(text),
				});

				if (best) new Icon({ tag: 'span', appendTo: td, icon: 'star', style: { marginLeft: '4px' } });
			});
		}

		// Regression footnote
		const { slope, intercept } = r.regression;
		const slopeSign = slope >= 0 ? '+' : '';
		new Footnote({
			appendTo: body,
			textContent: `Trend: yield = ${formatN(slope, 4)} × rate ${slopeSign}${formatN(intercept)}  ·  r = ${formatN(r.pearsonR, 3)}  ·  ${r.pairCount.toLocaleString()} matched pairs`,
		});
	}
}
