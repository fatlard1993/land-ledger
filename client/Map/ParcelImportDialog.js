import { Button, Card, Component, Dialog, Elem, Icon, Input, theme } from '@vanilla-bean/components';

import { DropZone, Lead, PreviewList } from './dialogParts';

const { colors } = theme;

export default class ParcelImportDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Import Property Lines from File',
			buttons: ['Cancel'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._pendingFeatures = [];

		new Lead({ appendTo: this.body, textContent: 'Import parcel/property line data from your county GIS portal.' });

		// Guidance
		const guide = new Card({
			appendTo: this.body,
			accent: colors.orange,
			style: { marginBottom: '12px', fontSize: '12px', color: colors.muted },
		});

		new Elem({
			tag: 'div',
			appendTo: guide,
			style: { fontWeight: '600', color: colors.light(colors.orange), marginBottom: '4px' },
			textContent: "Finding your county's parcel data:",
		});
		new Elem({ tag: 'div', appendTo: guide, textContent: '1. Search "[county name] GIS open data parcels"' });
		new Elem({ tag: 'div', appendTo: guide, textContent: '2. Many counties have ArcGIS Hub or county GIS portal' });
		new Elem({ tag: 'div', appendTo: guide, textContent: '3. Download as GeoJSON, Shapefile, or KML' });
		new Elem({
			tag: 'div',
			appendTo: guide,
			style: { marginTop: '4px' },
			textContent: '→ Accepts .geojson, .json files (Shapefile: convert at mapshaper.org first)',
		});

		const dropZone = new DropZone({ appendTo: this.body });

		new Icon({ appendTo: dropZone, addClass: 'drop-icon', icon: 'file-import' });
		new Elem({ tag: 'div', appendTo: dropZone, textContent: 'Drop county parcel GeoJSON here or tap to browse' });

		new Input({
			type: 'file',
			accept: '.geojson,.json',
			style: { display: 'none' },
			dropZone,
			onFiles: ([file]) => this._process(file),
			appendTo: dropZone,
		});

		this._preview = new Component({ appendTo: this.body });
	}

	async _process(file) {
		try {
			const text = await file.text();
			const geojson = JSON.parse(text);
			let all;
			if (geojson.type === 'FeatureCollection') {
				all = geojson.features;
			} else if (geojson.type === 'Feature') {
				all = [geojson];
			} else {
				all = [{ type: 'Feature', geometry: geojson, properties: {} }];
			}
			const polys = all.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');

			if (!polys.length) {
				this._preview.empty();
				new Elem({
					tag: 'p',
					appendTo: this._preview,
					style: { color: colors.light(colors.danger), fontSize: '13px' },
					textContent: 'No polygon features found in this file.',
				});
				return;
			}

			this._pendingFeatures = polys;
			this._renderPreview(polys);
		} catch {
			this._preview.empty();
			new Elem({
				tag: 'p',
				appendTo: this._preview,
				style: { color: colors.light(colors.danger), fontSize: '13px' },
				textContent: 'Could not read file — make sure it is valid GeoJSON.',
			});
		}
	}

	_renderPreview(features) {
		this._preview.empty();

		new Elem({
			tag: 'p',
			appendTo: this._preview,
			style: { fontSize: '13px', margin: '12px 0 6px' },
			textContent: `Found ${features.length} polygon${features.length !== 1 ? 's' : ''} — they will be saved as property lines:`,
		});

		const list = new PreviewList({ appendTo: this._preview, style: { maxHeight: '160px' } });

		for (const [i, f] of features.slice(0, 20).entries()) {
			const p = f.properties || {};
			const name =
				p.name || p.NAME || p.OWNER || p.OWNER_NAME || p.APN || p.PARCEL_ID || p.PARCELID || `Parcel ${i + 1}`;

			new Elem({ tag: 'div', appendTo: list, textContent: `📐 ${name}` });
		}

		if (features.length > 20) {
			new Elem({ tag: 'div', appendTo: list, addClass: 'more', textContent: `… and ${features.length - 20} more` });
		}

		new Button({
			appendTo: this._preview,
			textContent: `Import All ${features.length} Property Lines`,
			style: { width: '100%' },
			onPointerPress: () => {
				this.options.onImport?.(this._pendingFeatures);
				this.close();
			},
		});
	}
}
