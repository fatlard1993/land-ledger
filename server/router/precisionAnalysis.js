import { readFile } from 'fs/promises';
import { requestMatch } from '@vanilla-bean/components/app';
import { precisionLayers } from '../database';

import { layerPointsPath } from './precisionLayers';

// ── Spatial join helpers ───────────────────────────────────────────────────────

// Build a spatial grid from points for O(1) nearest-neighbor lookups.
// Grid cell ≈ 111m × 111m at 0.001° — roughly one combine header width.
const GRID_SIZE = 0.001;

function buildGrid(points) {
	const grid = new Map();
	for (const pt of points) {
		const key = `${Math.floor(pt.lat / GRID_SIZE)},${Math.floor(pt.lng / GRID_SIZE)}`;
		if (!grid.has(key)) grid.set(key, []);
		grid.get(key).push(pt);
	}
	return grid;
}

function findNearest(target, grid) {
	const cellLat = Math.floor(target.lat / GRID_SIZE);
	const cellLng = Math.floor(target.lng / GRID_SIZE);

	let minDist = Infinity;
	let nearest = null;

	// Search 3×3 neighbourhood; expand to 5×5 if nothing found
	for (let radius = 1; radius <= 3 && !nearest; radius++) {
		for (let dLat = -radius; dLat <= radius; dLat++) {
			for (let dLng = -radius; dLng <= radius; dLng++) {
				const cell = grid.get(`${cellLat + dLat},${cellLng + dLng}`);
				if (!cell) continue;
				for (const pt of cell) {
					const d = (pt.lat - target.lat) ** 2 + (pt.lng - target.lng) ** 2;
					if (d < minDist) {
						minDist = d;
						nearest = pt;
					}
				}
			}
		}
		// Only expand radius if the 3×3 found nothing
		if (nearest) break;
	}

	return nearest;
}

// ── Statistics ─────────────────────────────────────────────────────────────────
// Computes both Pearson r and linear regression in two passes over pairs,
// sharing the mean calculation that both formulas require.

function computeStats(pairs) {
	const n = pairs.length;
	if (n < 2) return { pearsonR: null, regression: { slope: 0, intercept: 0 } };

	const xMean = pairs.reduce((s, p) => s + p.applied, 0) / n;
	const yMean = pairs.reduce((s, p) => s + p.yield, 0) / n;

	let cov = 0,
		sx = 0,
		sy = 0;
	for (const p of pairs) {
		const dx = p.applied - xMean;
		const dy = p.yield - yMean;
		cov += dx * dy;
		sx += dx * dx;
		sy += dy * dy;
	}

	const pearsonR = sx > 0 && sy > 0 ? cov / Math.sqrt(sx * sy) : 0;
	const slope = sx > 0 ? cov / sx : 0;
	const intercept = yMean - slope * xMean;

	return { pearsonR, regression: { slope, intercept } };
}

// Split pairs into nZones quantile buckets by applied rate, compute yield stats per zone
function zoneAnalysis(pairs, nZones = 5) {
	const sorted = [...pairs].sort((a, b) => a.applied - b.applied);
	const size = Math.ceil(sorted.length / nZones);

	return Array.from({ length: nZones }, (_, i) => {
		const zone = sorted.slice(i * size, (i + 1) * size);
		if (!zone.length) return null;

		const appliedMean = zone.reduce((s, p) => s + p.applied, 0) / zone.length;
		const yieldMean = zone.reduce((s, p) => s + p.yield, 0) / zone.length;
		const yieldMin = Math.min(...zone.map(p => p.yield));
		const yieldMax = Math.max(...zone.map(p => p.yield));

		return {
			zoneIndex: i + 1,
			count: zone.length,
			appliedMin: zone[0].applied,
			appliedMax: zone[zone.length - 1].applied,
			appliedMean: parseFloat(appliedMean.toFixed(3)),
			yieldMean: parseFloat(yieldMean.toFixed(2)),
			yieldMin: parseFloat(yieldMin.toFixed(2)),
			yieldMax: parseFloat(yieldMax.toFixed(2)),
		};
	}).filter(Boolean);
}

// Reservoir-sample pairs down to ~maxPoints for efficient client rendering
function downsample(pairs, maxPoints = 500) {
	if (pairs.length <= maxPoints) return pairs;

	const sample = pairs.slice(0, maxPoints);
	for (let i = maxPoints; i < pairs.length; i++) {
		const j = Math.floor(Math.random() * (i + 1));
		if (j < maxPoints) sample[j] = pairs[i];
	}
	return sample;
}

// ── Points loader ──────────────────────────────────────────────────────────────

async function loadPoints(layerId) {
	try {
		const text = await readFile(layerPointsPath(layerId), 'utf-8');
		return JSON.parse(text).points ?? [];
	} catch (e) {
		if (e.code === 'ENOENT') return [];
		throw e;
	}
}

// ── Handler ────────────────────────────────────────────────────────────────────

const handleAnalyze = async request => {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { appliedLayerId, yieldLayerId } = body;

	if (!appliedLayerId || !yieldLayerId) {
		return new Response('appliedLayerId and yieldLayerId required', { status: 400 });
	}

	if (appliedLayerId === yieldLayerId) {
		return new Response('appliedLayerId and yieldLayerId must be different layers', { status: 400 });
	}

	const appliedMeta = precisionLayers.read({ id: appliedLayerId });
	const yieldMeta = precisionLayers.read({ id: yieldLayerId });

	if (!appliedMeta) return new Response(`Layer ${appliedLayerId} not found`, { status: 404 });
	if (!yieldMeta) return new Response(`Layer ${yieldLayerId} not found`, { status: 404 });

	const [appliedPoints, yieldPoints] = await Promise.all([loadPoints(appliedLayerId), loadPoints(yieldLayerId)]);

	if (!appliedPoints.length) return new Response('Applied layer has no point data', { status: 422 });
	if (!yieldPoints.length) return new Response('Yield layer has no point data', { status: 422 });

	// Spatial join: nearest-neighbor match each yield point to its closest applied point
	const grid = buildGrid(appliedPoints);

	const pairs = [];
	for (const yPt of yieldPoints) {
		const nearest = findNearest(yPt, grid);
		if (nearest) pairs.push({ applied: nearest.value, yield: yPt.value, lat: yPt.lat, lng: yPt.lng });
	}

	if (!pairs.length)
		return new Response('No matching points found — layers may not overlap spatially', { status: 422 });

	const { pearsonR, regression } = computeStats(pairs);
	const zones = zoneAnalysis(pairs);
	const scatter = downsample(pairs).map(p => ({ x: p.applied, y: p.yield }));

	// Best zone: highest mean yield
	const bestZone = zones.reduce((best, z) => (z.yieldMean > best.yieldMean ? z : best), zones[0]);

	return Response.json({
		appliedLayer: {
			id: appliedLayerId,
			label: appliedMeta.label,
			valueUnit: appliedMeta.valueUnit,
			type: appliedMeta.type,
		},
		yieldLayer: { id: yieldLayerId, label: yieldMeta.label, valueUnit: yieldMeta.valueUnit, type: yieldMeta.type },
		pairCount: pairs.length,
		pearsonR: pearsonR !== null ? parseFloat(pearsonR.toFixed(3)) : null,
		regression: {
			slope: parseFloat(regression.slope.toFixed(4)),
			intercept: parseFloat(regression.intercept.toFixed(2)),
		},
		zones,
		bestZone,
		scatter,
	});
};

// ── Router ─────────────────────────────────────────────────────────────────────

const precisionAnalysisRouter = async request => {
	if (requestMatch('POST', '/precision-layers/analyze', request)) return handleAnalyze(request);
};

export default precisionAnalysisRouter;
