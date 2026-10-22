import { Dialog, Card, Component, Elem, Button, SectionLabel, styled, theme } from '@vanilla-bean/components';

const { colors, space } = theme;

const SECTION_STYLE = { margin: `${space.md} 0 ${space.sm}` };

const ExportRow = styled(
	Card,
	({ colors, space }) => `
		display: flex;
		align-items: center;
		gap: ${space.md};
		padding: ${space.sm} ${space.md};

		/* The everyday exports stand out with a hairline */
		&.featured {
			box-shadow: inset 0 0 0 1px ${colors.border};
		}

		& .export-label {
			font-size: 13px;
			font-weight: 600;
			color: ${colors.white};
		}

		& .export-sub {
			margin-top: 1px;
			font-size: 11px;
			color: ${colors.gray};
		}

		& .export-ext {
			flex-shrink: 0;
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.06em;
		}
	`,
);

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
	const row = new ExportRow({ appendTo: container, interactive: true });

	if (accent) row.addClass('featured');

	const info = new Component({ appendTo: row, style: { flex: '1', minWidth: '0' } });

	new Elem({ tag: 'div', appendTo: info, addClass: 'export-label', textContent: label });
	new Elem({ tag: 'div', appendTo: info, addClass: 'export-sub', textContent: sub });

	const extUpper = ext.toUpperCase();
	let extColor;
	if (extUpper === 'GEOJSON') extColor = colors.light(colors.blue);
	else if (extUpper === 'CSV') extColor = colors.light(colors.green);
	else extColor = colors.light(colors.yellow);
	new Elem({ tag: 'div', appendTo: row, addClass: 'export-ext', style: { color: extColor }, textContent: extUpper });

	new Button({
		appendTo: row,
		icon: 'download',
		title: `Download ${label}`,
		style: { flexShrink: '0' },
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
			style: { fontSize: '13px', color: colors.muted, margin: `0 0 ${space.xs}` },
			textContent: 'Files download instantly — no data leaves your machine.',
		});

		for (const { section, items } of EXPORTS) {
			new SectionLabel({ appendTo: this.body, style: SECTION_STYLE, textContent: section });

			const grid = new Component({
				appendTo: this.body,
				style: { display: 'flex', flexDirection: 'column', gap: space.xs },
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

		new SectionLabel({ appendTo: this.body, style: SECTION_STYLE, textContent: 'Saved Templates' });

		const grid = new Component({
			appendTo: this.body,
			style: { display: 'flex', flexDirection: 'column', gap: space.xs },
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
