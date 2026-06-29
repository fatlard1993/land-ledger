import { Dialog, Component, Elem, Button } from '@vanilla-bean/components';
import { styled } from '@vanilla-bean/components';

const DropZone = styled(
	Component,
	({ colors }) => `
		border: 2px dashed ${colors.gray};
		border-radius: 8px;
		padding: 28px 16px;
		text-align: center;
		cursor: pointer;
		color: ${colors.gray};
		transition: border-color 0.15s, color 0.15s;
		margin: 8px 0;

		&.drag-over {
			border-color: #ff9500;
			color: #ff9500;
		}
	`,
);

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

		new Elem({
			tag: 'p',
			appendTo: this.body,
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' },
			textContent: 'Import parcel/property line data from your county GIS portal.',
		});

		// Guidance
		const guide = new Component({
			appendTo: this.body,
			style: {
				background: 'rgba(255,149,0,0.08)',
				border: '1px solid rgba(255,149,0,0.25)',
				borderRadius: '6px',
				padding: '10px 12px',
				marginBottom: '12px',
				fontSize: '12px',
				color: 'rgba(255,255,255,0.6)',
			},
		});

		new Elem({
			tag: 'div',
			appendTo: guide,
			style: { fontWeight: '600', color: '#ffb84d', marginBottom: '4px' },
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
		const fileInput = new Elem({
			tag: 'input',
			appendTo: dropZone,
			attributes: { type: 'file', accept: '.geojson,.json', style: 'display:none' },
		});

		new Elem({ tag: 'div', appendTo: dropZone, style: { fontSize: '28px', marginBottom: '6px' }, textContent: '📐' });
		new Elem({
			tag: 'div',
			appendTo: dropZone,
			style: { fontSize: '14px' },
			textContent: 'Drop county parcel GeoJSON here or tap to browse',
		});

		dropZone.onPointerPress(() => fileInput.elem.click());
		dropZone.elem.addEventListener('dragover', e => {
			e.preventDefault();
			dropZone.addClass('drag-over');
		});
		dropZone.elem.addEventListener('dragleave', () => dropZone.removeClass('drag-over'));
		dropZone.elem.addEventListener('drop', e => {
			e.preventDefault();
			dropZone.removeClass('drag-over');
			const f = e.dataTransfer?.files?.[0];
			if (f) this._process(f);
		});
		fileInput.elem.addEventListener('change', () => {
			const f = fileInput.elem.files?.[0];
			if (f) this._process(f);
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
					style: { color: '#e05252', fontSize: '13px' },
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
				style: { color: '#e05252', fontSize: '13px' },
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

		const list = new Component({
			appendTo: this._preview,
			style: {
				maxHeight: '160px',
				overflowY: 'auto',
				border: '1px solid rgba(255,255,255,0.1)',
				borderRadius: '6px',
				marginBottom: '10px',
			},
		});

		for (const [i, f] of features.slice(0, 20).entries()) {
			const p = f.properties || {};
			const name =
				p.name || p.NAME || p.OWNER || p.OWNER_NAME || p.APN || p.PARCEL_ID || p.PARCELID || `Parcel ${i + 1}`;

			new Elem({
				tag: 'div',
				appendTo: list,
				style: { padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '12px' },
				textContent: `📐 ${name}`,
			});
		}

		if (features.length > 20) {
			new Elem({
				tag: 'div',
				appendTo: list,
				style: { padding: '5px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' },
				textContent: `… and ${features.length - 20} more`,
			});
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
