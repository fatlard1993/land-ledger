// Shared style constants and helpers used across Map layers.

export const TENURE_COLORS = {
	own: { color: '#4a90d9', fillColor: '#4a90d9', fillOpacity: 0.18 },
	rent: { color: '#e8832a', fillColor: '#e8832a', fillOpacity: 0.18 },
};

// Unified status color palette — used for all entity types on the map
export const STATUS_STYLES = {
	needs_maintenance: { color: '#e8832a', fillColor: '#e8832a', fillOpacity: 0.25, opacity: 0.9, label: '🔩' },
	needs_service: { color: '#e8c42a', fillColor: '#e8c42a', fillOpacity: 0.2, opacity: 0.85, label: '🔧' },
	out_of_service: { color: '#777', fillColor: '#888', fillOpacity: 0.08, opacity: 0.45, label: '⚠️' },
	fallow: { color: '#5a7a3a', fillColor: '#5a7a3a', fillOpacity: 0.12, opacity: 0.6, label: '😴' },
	abandoned: { color: '#8b4513', fillColor: '#8b4513', fillOpacity: 0.1, opacity: 0.5, label: '🏚️' },
	closed: { color: '#777', fillColor: '#888', fillOpacity: 0.08, opacity: 0.45, dashArray: '3,3', label: '🚫' },
	disputed: { color: '#9c6de8', fillColor: '#9c6de8', fillOpacity: 0.15, opacity: 0.8, label: '⚖️' },
	encumbered: { color: '#e8c42a', fillColor: '#e8c42a', fillOpacity: 0.1, opacity: 0.7, label: '🔒' },
	destroyed: { color: '#8b1a1a', fillColor: '#8b1a1a', fillOpacity: 0.1, opacity: 0.55, dashArray: '4,3', label: '☠️' },
};

export const statusStyle = status => STATUS_STYLES[status] || null;

export const USE_FILLS = {
	livestock: { fillColor: '#a0522d', fillOpacity: 0.45 },
	crop: { fillColor: '#e8c42a', fillOpacity: 0.35 },
	cover_crop: { fillColor: '#4caf50', fillOpacity: 0.4 },
	fallow: { fillColor: '#9e9e9e', fillOpacity: 0.2 },
};

export const USE_ICONS = {
	livestock: '🐄',
	crop: '🌽',
	cover_crop: '🌱',
	soil_test: '🔬',
	input: '🧪',
	tillage: '🚜',
	observation: '👁️',
};

export const CURRENT_YEAR = new Date().getFullYear();

export const PARCEL_STYLE = {
	color: '#ff9500',
	fillOpacity: 0,
	weight: 8, // wide enough to tap on mobile; pointer-events: stroke keeps interior clickable
	dashArray: '10, 6',
	opacity: 0.65,
	className: 'parcel-stroke-only',
};

export const BUILDING_STYLE = {
	color: '#c8a882',
	fillColor: '#c8a882',
	fillOpacity: 0.5,
	weight: 2,
	opacity: 0.9,
};

export const REFERENCE_STYLE = {
	color: '#00bcd4',
	fillColor: '#00bcd4',
	fillOpacity: 0.04,
	weight: 1.5,
	dashArray: '6,4',
	opacity: 0.7,
};

export const REFERENCE_HOVER_STYLE = {
	fillOpacity: 0.15,
	weight: 2.5,
	opacity: 1,
};
