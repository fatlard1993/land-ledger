import { Dialog, Component, Elem } from '@vanilla-bean/components';
import Chart from 'chart.js/auto';
import { analyzePrecisionLayers } from '../api/precisionLayers';

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
		this._run(options.appliedLayer, options.yieldLayer);
	}

	async _run(appliedLayer, yieldLayer) {
		this.body.empty();

		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' },
			textContent: `Joining ${appliedLayer.label} → ${yieldLayer.label}…`,
		});

		let result;
		try {
			result = await analyzePrecisionLayers({
				appliedLayerId: appliedLayer.id,
				yieldLayerId: yieldLayer.id,
			});
		} catch (err) {
			this.body.empty();
			new Elem({
				tag: 'div',
				appendTo: this.body,
				style: { color: '#e05252', fontSize: '13px' },
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
		const summary = new Component({
			appendTo: body,
			style: { background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' },
		});

		new Elem({
			tag: 'div',
			appendTo: summary,
			style: { fontSize: '13px', color: '#fff', fontWeight: '600', marginBottom: '4px' },
			textContent: `${r.pairCount.toLocaleString()} matched point pairs across field`,
		});
		new Elem({
			tag: 'div',
			appendTo: summary,
			style: { fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5' },
			textContent: interpretR(r.pearsonR),
		});

		// Best zone callout
		if (r.bestZone) {
			const best = r.bestZone;
			new Elem({
				tag: 'div',
				appendTo: summary,
				style: { fontSize: '12px', color: '#4caf50', marginTop: '6px', fontWeight: '500' },
				textContent: `Highest yield at zone ${best.zoneIndex}: avg rate ${formatN(best.appliedMean, 0)} ${appliedLayer.valueUnit ?? ''} → ${formatN(best.yieldMean)} ${yieldLayer.valueUnit ?? ''}`,
			});
		}

		// ── Scatter plot ─────────────────────────────────────────────────────────
		new Elem({
			tag: 'div',
			appendTo: body,
			style: {
				fontSize: '11px',
				textTransform: 'uppercase',
				letterSpacing: '.07em',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '6px',
			},
			textContent: 'Rate vs Yield',
		});

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
						backgroundColor: 'rgba(74,144,217,0.35)',
						pointRadius: 3,
						order: 2,
					},
					{
						label: 'Trend',
						type: 'line',
						data: trendLine,
						borderColor: 'rgba(232,196,42,0.8)',
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
							color: 'rgba(255,255,255,0.5)',
							font: { size: 11 },
						},
						grid: { color: 'rgba(255,255,255,0.07)' },
						ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
					},
					y: {
						title: {
							display: true,
							text: `Yield (${yieldLayer.valueUnit ?? ''})`,
							color: 'rgba(255,255,255,0.5)',
							font: { size: 11 },
						},
						grid: { color: 'rgba(255,255,255,0.07)' },
						ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
					},
				},
			},
		});

		// ── Zone breakdown ───────────────────────────────────────────────────────
		new Elem({
			tag: 'div',
			appendTo: body,
			style: {
				fontSize: '11px',
				textTransform: 'uppercase',
				letterSpacing: '.07em',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '6px',
			},
			textContent: 'Zones by applied rate',
		});

		const table = new Elem({ tag: 'table', appendTo: body });
		table.elem.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';

		const thead = new Elem({ tag: 'thead', appendTo: table });
		const hRow = new Elem({ tag: 'tr', appendTo: thead });
		for (const [text, align] of [
			['Zone', 'left'],
			['Rate range', 'right'],
			['Avg rate', 'right'],
			['Avg yield', 'right'],
			['Points', 'right'],
		]) {
			const th = new Elem({ tag: 'th', appendTo: hRow, textContent: text });
			th.elem.style.cssText = `text-align:${align};padding:4px 6px;color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.1);`;
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
				const td = new Elem({ tag: 'td', appendTo: tr, textContent: String(isBest && i === 3 ? text + ' ★' : text) });
				td.elem.style.cssText = `padding:5px 6px;text-align:${i === 0 ? 'left' : 'right'};border-bottom:1px solid rgba(255,255,255,0.05);color:${isBest && i === 3 ? '#4caf50' : 'rgba(255,255,255,0.7)'};font-weight:${isBest && i === 3 ? '700' : '400'};`;
			});
		}

		// Regression footnote
		const { slope, intercept } = r.regression;
		const slopeSign = slope >= 0 ? '+' : '';
		new Elem({
			tag: 'div',
			appendTo: body,
			style: { fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '8px', lineHeight: '1.5' },
			textContent: `Trend: yield = ${formatN(slope, 4)} × rate ${slopeSign}${formatN(intercept)}  ·  r = ${formatN(r.pearsonR, 3)}  ·  ${r.pairCount.toLocaleString()} matched pairs`,
		});
	}

	close() {
		if (this._chart) {
			this._chart.destroy();
			this._chart = null;
		}
		super.close();
	}
}
