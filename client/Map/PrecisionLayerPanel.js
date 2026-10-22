import { Button, Component, theme } from '@vanilla-bean/components';
import { ActionHeader } from '../Layout';
import { getPrecisionLayers, getPrecisionLayerPoints, deletePrecisionLayer } from '../api/precisionLayers';
import PrecisionLayerImport from './PrecisionLayerImport';
import PrecisionAnalysisDialog from './PrecisionAnalysisDialog';
import { EmptyNote, HeaderButton, PanelRow, RowGlyph, RowMain, RowMeta, RowTitle, SubLabel } from './panelParts';

const { colors, space } = theme;

const TYPE_LABELS = { yield: 'Yield map', 'as-applied': 'As-applied', 'soil-ec': 'Soil EC', other: 'Data layer' };
const TYPE_ICONS = { yield: '🌾', 'as-applied': '🌱', 'soil-ec': '⚡', other: '📡' };

const formatNum = (n, d = 1) => (n != null ? Number(n).toFixed(d) : '—');

// ── Color scale ────────────────────────────────────────────────────────────────
// Maps a normalized [0,1] value to a green→yellow→red color.
// High values (yield) are green; low values are red. A continuous heat scale over the map rather than the theme's
// palette: its full-saturation hues are what make zones legible on aerial imagery.

export function valueToColor(value, min, max) {
	const t = max > min ? (value - min) / (max - min) : 0.5;
	const hue = t * 120; // 0 = red, 120 = green
	return `hsl(${hue.toFixed(0)},85%,50%)`;
}

// ── Renderer ───────────────────────────────────────────────────────────────────
// Called by Map.js to draw/clear the active layer on the Leaflet canvas.

export function renderPrecisionLayer(layer, L, layerGroup) {
	layerGroup.clearLayers();

	if (!layer?.points?.length) return;

	const { min, max } = layer.stats;

	for (const pt of layer.points) {
		L.circleMarker([pt.lat, pt.lng], {
			radius: 4,
			color: 'transparent',
			fillColor: valueToColor(pt.value, min, max),
			fillOpacity: 0.85,
			renderer: L.canvas(), // canvas for performance with thousands of points
		})
			.bindTooltip(`${pt.value.toFixed(2)} ${layer.valueUnit}`, { sticky: true })
			.addTo(layerGroup);
	}
}

// ── Panel section ──────────────────────────────────────────────────────────────

export async function renderPrecisionLayersSection(field, container, callbacks = {}) {
	const data = await getPrecisionLayers().catch(() => ({ body: {} }));
	const all = Object.values(data?.body || {});
	const layers = field ? all.filter(l => l.fieldId === field.id) : all;

	// Section header
	const header = new ActionHeader({ appendTo: container, title: 'Data Layers' });

	new HeaderButton({
		appendTo: header,
		icon: 'plus',
		textContent: 'Import',
		style: { marginTop: space.md },
		onPointerPress: () =>
			new PrecisionLayerImport({
				presetFieldId: field?.id,
				onImport: () => {
					callbacks.onRefresh?.();
				},
			}),
	});

	if (!layers.length) {
		new EmptyNote({ appendTo: container, textContent: 'No layers — import a yield map or as-applied file' });
		return;
	}

	for (const layer of layers.sort((a, b) => (b.season || 0) - (a.season || 0))) {
		const row = new PanelRow({ appendTo: container });

		new RowGlyph({ appendTo: row, textContent: TYPE_ICONS[layer.type] ?? '📡' });

		const info = new RowMain({ appendTo: row });

		new RowTitle({
			appendTo: info,
			style: { fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
			textContent: layer.label || `${TYPE_LABELS[layer.type] ?? 'Layer'} ${layer.season ?? ''}`,
		});

		// Stats strip
		const s = layer.stats;
		if (s) {
			const statParts = [
				s.mean != null ? `avg ${formatNum(s.mean)} ${layer.valueUnit ?? ''}`.trim() : null,
				s.cv != null ? `CV ${formatNum(s.cv)}%` : null,
				s.count ? `${s.count.toLocaleString()} pts` : null,
			].filter(Boolean);

			new RowMeta({ appendTo: info, style: { marginTop: space.xs }, textContent: statParts.join('  ·  ') });

			// Min / max color legend strip
			if (s.min != null && s.max != null) {
				const legend = new RowMeta({
					appendTo: info,
					style: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.xs, fontSize: '10px' },
				});

				new Component({ tag: 'span', appendTo: legend, textContent: formatNum(s.min) });

				new Component({
					appendTo: legend,
					style: {
						flex: '1',
						height: '4px',
						borderRadius: '2px',
						background: 'linear-gradient(to right, hsl(0,85%,50%), hsl(60,85%,50%), hsl(120,85%,50%))',
					},
				});

				new Component({ tag: 'span', appendTo: legend, textContent: formatNum(s.max) });
			}
		}

		// Show / remove buttons
		const buttons = new Component({
			appendTo: row,
			style: { display: 'flex', flexDirection: 'column', gap: space.xs, flexShrink: '0' },
		});

		new HeaderButton({
			appendTo: buttons,
			textContent: 'Show',
			title: 'Display on map',
			onPointerPress: async () => {
				// Points live in a separate file — load only when the user taps Show
				const points = layer.points ?? (await getPrecisionLayerPoints(layer.id));
				if (points) callbacks.onShowLayer?.({ ...layer, points });
			},
		});

		new HeaderButton({
			appendTo: buttons,
			variant: 'flat',
			icon: 'xmark',
			title: 'Delete layer',
			style: { color: colors.light(colors.danger) },
			onPointerPress: async () => {
				await deletePrecisionLayer(layer.id);
				callbacks.onRefresh?.();
			},
		});
	}

	// ── Cross-layer analysis ───────────────────────────────────────────────────
	// Show Analyze button for each season that has both a yield and as-applied layer.
	const bySeasonYield = {};
	const bySeasonApplied = {};

	for (const l of layers) {
		if (l.type === 'yield') bySeasonYield[l.season ?? 0] = l;
		if (l.type === 'as-applied') bySeasonApplied[l.season ?? 0] = l;
	}

	const analyzeSeasons = Object.keys(bySeasonYield).filter(s => bySeasonApplied[s]);

	if (analyzeSeasons.length) {
		new SubLabel({ appendTo: container, textContent: 'Analysis' });

		for (const season of analyzeSeasons) {
			const yieldL = bySeasonYield[season];
			const appliedL = bySeasonApplied[season];

			new Button({
				appendTo: container,
				textContent: `${season} — Rate vs Yield correlation`,
				variant: 'flat',
				icon: 'chart-line',
				style: {
					width: '100%',
					marginBottom: space.xs,
					textAlign: 'left',
					fontSize: '12px',
					backgroundColor: colors.alpha(colors.info, 0.1),
					color: colors.light(colors.info),
				},
				onPointerPress: () =>
					new PrecisionAnalysisDialog({
						appliedLayer: appliedL,
						yieldLayer: yieldL,
					}),
			});
		}
	}
}
