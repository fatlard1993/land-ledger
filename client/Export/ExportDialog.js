import { Dialog, Component, Elem, Button } from '@vanilla-bean/components';

const SECTION_STYLE = {
	fontSize: '10px',
	textTransform: 'uppercase',
	letterSpacing: '.08em',
	color: 'rgba(255,255,255,0.35)',
	margin: '14px 0 6px',
};

const EXPORTS = [
	{
		section: 'Map Features',
		items: [
			{
				label: 'Fields',
				sub: 'GeoJSON — field polygons + all properties',
				url: '/export/geojson?type=fields',
				ext: 'geojson',
			},
			{
				label: 'Buildings',
				sub: 'GeoJSON — building footprints',
				url: '/export/geojson?type=buildings',
				ext: 'geojson',
			},
			{
				label: 'Parcels',
				sub: 'GeoJSON — property line polygons',
				url: '/export/geojson?type=parcels',
				ext: 'geojson',
			},
			{ label: 'Paths', sub: 'GeoJSON — roads, lanes, trails', url: '/export/geojson?type=paths', ext: 'geojson' },
			{
				label: 'Equipment',
				sub: 'GeoJSON — equipment pin locations',
				url: '/export/geojson?type=equipment',
				ext: 'geojson',
			},
			{
				label: 'All features',
				sub: 'GeoJSON — every mapped entity in one file',
				url: '/export/geojson?type=all',
				ext: 'geojson',
				accent: true,
			},
		],
	},
	{
		section: 'Records',
		items: [
			{
				label: 'Events / Timeline',
				sub: 'CSV — crop, livestock, soil tests, inputs…',
				url: '/export/csv?collection=events',
				ext: 'csv',
			},
			{ label: 'Supplies', sub: 'CSV — current inventory + costs', url: '/export/csv?collection=supplies', ext: 'csv' },
			{
				label: 'Equipment list',
				sub: 'CSV — registry with status and usage',
				url: '/export/csv?collection=equipment',
				ext: 'csv',
			},
			{
				label: 'Maintenance logs',
				sub: 'CSV — service records with costs and parts',
				url: '/export/csv?collection=maintenance',
				ext: 'csv',
			},
			{
				label: 'Revenue',
				sub: 'CSV — income records by type and source',
				url: '/export/csv?collection=revenue',
				ext: 'csv',
			},
			{
				label: 'Incidents',
				sub: 'CSV — incident reports with severity and losses',
				url: '/export/csv?collection=incidents',
				ext: 'csv',
			},
			{
				label: 'Leases',
				sub: 'CSV — active and historical lease records',
				url: '/export/csv?collection=leases',
				ext: 'csv',
			},
			{
				label: 'Budget items',
				sub: 'CSV — income and expense budgets',
				url: '/export/csv?collection=budgetItems',
				ext: 'csv',
			},
			{
				label: 'Application records',
				sub: 'CSV — pesticide, herbicide, fertilizer logs with EPA numbers',
				url: '/export/csv?collection=applicationLogs',
				ext: 'csv',
			},
		],
	},
	{
		section: 'Backup',
		items: [
			{
				label: 'Full backup',
				sub: 'JSON — complete database, safe to restore from',
				url: '/export/json',
				ext: 'json',
				accent: true,
			},
		],
	},
];

function triggerDownload(url) {
	const a = document.createElement('a');
	a.href = url;
	a.style.display = 'none';
	document.body.append(a);
	a.click();
	setTimeout(() => a.remove(), 100);
}

function renderExportRow(container, { label, sub, url, ext, accent = false }) {
	const row = new Component({
		appendTo: container,
		style: {
			display: 'flex',
			alignItems: 'center',
			gap: '10px',
			padding: '7px 10px',
			background: 'rgba(255,255,255,0.04)',
			border: `1px solid ${accent ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
			borderRadius: '6px',
			cursor: 'pointer',
		},
	});

	const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

	new Elem({
		tag: 'div',
		appendTo: info,
		style: { fontSize: '13px', fontWeight: '600', color: '#fff' },
		textContent: label,
	});
	new Elem({
		tag: 'div',
		appendTo: info,
		style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' },
		textContent: sub,
	});

	const extUpper = ext.toUpperCase();
	let extColor;
	if (extUpper === 'GEOJSON') extColor = '#4a90d9';
	else if (extUpper === 'CSV') extColor = '#4caf50';
	else extColor = '#e8c42a';
	new Elem({
		tag: 'div',
		appendTo: row,
		style: {
			fontSize: '10px',
			fontWeight: '700',
			color: extColor,
			flexShrink: '0',
			letterSpacing: '.06em',
		},
		textContent: extUpper,
	});

	new Button({
		appendTo: row,
		textContent: '↓',
		title: `Download ${label}`,
		style: { fontSize: '16px', padding: '3px 10px', flexShrink: '0', fontWeight: '700' },
		onPointerPress: () => triggerDownload(url),
	});

	row.onPointerPress(e => {
		if (e.target.closest('button')) return;
		triggerDownload(url);
	});
}

export default class ExportDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Export Data',
			buttons: ['Close'],
			onButtonPress: () => this.close(),
			...options,
		});

		new Elem({
			tag: 'p',
			appendTo: this.body,
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' },
			textContent: 'Files download instantly — no data leaves your machine.',
		});

		for (const { section, items } of EXPORTS) {
			new Elem({ tag: 'div', appendTo: this.body, style: SECTION_STYLE, textContent: section });

			const grid = new Component({
				appendTo: this.body,
				style: { display: 'flex', flexDirection: 'column', gap: '4px' },
			});

			for (const item of items) renderExportRow(grid, item);
		}

		// Saved import templates — generates a CSV whose columns match the template exactly,
		// so the export→edit→reimport cycle needs no remapping.
		this._loadTemplateExports();
	}

	async _loadTemplateExports() {
		let templates;

		try {
			const res = await fetch('/import/tabular/templates');
			templates = res.ok ? await res.json() : [];
		} catch {
			return;
		}

		if (!templates.length || !this.body.elem.isConnected) return;

		new Elem({ tag: 'div', appendTo: this.body, style: SECTION_STYLE, textContent: 'Saved Templates' });

		const grid = new Component({
			appendTo: this.body,
			style: { display: 'flex', flexDirection: 'column', gap: '4px' },
		});

		for (const tpl of templates) {
			renderExportRow(grid, {
				label: tpl.name,
				sub: `${tpl.collection} · columns match your saved import mapping`,
				url: `/export/csv/template?name=${encodeURIComponent(tpl.name)}`,
				ext: 'csv',
			});
		}
	}
}
