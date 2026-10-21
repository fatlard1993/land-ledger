// Shared style constants and helpers used across Map layers.

import { theme } from '@vanilla-bean/components';

const { colors } = theme;

// Leaflet draws paths with CSS color strings
const hex = color => color.toHexString();

const owned = hex(colors.light(colors.info));
const rented = hex(colors.light(colors.orange));
const muted = hex(colors.gray);

export const TENURE_COLORS = {
	own: { color: owned, fillColor: owned, fillOpacity: 0.18 },
	rent: { color: rented, fillColor: rented, fillOpacity: 0.18 },
};

// Unified status color palette — used for all entity types on the map
export const STATUS_STYLES = {
	needs_maintenance: {
		color: hex(colors.orange),
		fillColor: hex(colors.orange),
		fillOpacity: 0.25,
		opacity: 0.9,
		label: '🔩',
	},
	needs_service: {
		color: hex(colors.warning),
		fillColor: hex(colors.warning),
		fillOpacity: 0.2,
		opacity: 0.85,
		label: '🔧',
	},
	out_of_service: { color: muted, fillColor: muted, fillOpacity: 0.08, opacity: 0.45, label: '⚠️' },
	fallow: {
		color: hex(colors.dark(colors.green)),
		fillColor: hex(colors.dark(colors.green)),
		fillOpacity: 0.12,
		opacity: 0.6,
		label: '😴',
	},
	abandoned: {
		color: hex(colors.darker(colors.orange)),
		fillColor: hex(colors.darker(colors.orange)),
		fillOpacity: 0.1,
		opacity: 0.5,
		label: '🏚️',
	},
	closed: { color: muted, fillColor: muted, fillOpacity: 0.08, opacity: 0.45, dashArray: '3,3', label: '🚫' },
	disputed: {
		color: hex(colors.light(colors.purple)),
		fillColor: hex(colors.light(colors.purple)),
		fillOpacity: 0.15,
		opacity: 0.8,
		label: '⚖️',
	},
	encumbered: {
		color: hex(colors.warning),
		fillColor: hex(colors.warning),
		fillOpacity: 0.1,
		opacity: 0.7,
		label: '🔒',
	},
	destroyed: {
		color: hex(colors.darkest(colors.red)),
		fillColor: hex(colors.darkest(colors.red)),
		fillOpacity: 0.1,
		opacity: 0.55,
		dashArray: '4,3',
		label: '☠️',
	},
};

export const statusStyle = status => STATUS_STYLES[status] || null;

export const USE_FILLS = {
	livestock: { fillColor: hex(colors.dark(colors.orange)), fillOpacity: 0.45 },
	crop: { fillColor: hex(colors.yellow), fillOpacity: 0.35 },
	cover_crop: { fillColor: hex(colors.green), fillOpacity: 0.4 },
	fallow: { fillColor: muted, fillOpacity: 0.2 },
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
	color: hex(colors.light(colors.orange)),
	fillOpacity: 0,
	weight: 8, // wide enough to tap on mobile; pointer-events: stroke keeps interior clickable
	dashArray: '10, 6',
	opacity: 0.65,
	className: 'parcel-stroke-only',
};

export const BUILDING_STYLE = {
	color: hex(colors.lighter(colors.orange)),
	fillColor: hex(colors.lighter(colors.orange)),
	fillOpacity: 0.5,
	weight: 2,
	opacity: 0.9,
};

export const REFERENCE_STYLE = {
	color: hex(colors.light(colors.teal)),
	fillColor: hex(colors.light(colors.teal)),
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
