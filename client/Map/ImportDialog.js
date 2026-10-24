import { Button, Component, Dialog, Elem, Icon, Input, Notify, theme } from '@vanilla-bean/components';

import { DropZone, Lead, PreviewList } from './dialogParts';

const { space } = theme;

export default class ImportDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Import Field Boundaries',
			buttons: ['Cancel'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._pendingFeatures = [];

		new Lead({
			appendTo: this.body,
			textContent: 'Import a GeoJSON file exported from farmers.gov, FieldView, or any GIS tool.',
		});

		const dropZone = new DropZone({ appendTo: this.body });

		new Icon({ appendTo: dropZone, addClass: 'drop-icon', icon: 'folder-open' });
		new Elem({ tag: 'div', appendTo: dropZone, textContent: 'Drop GeoJSON file here or tap to browse' });
		new Elem({ tag: 'div', appendTo: dropZone, addClass: 'drop-sub', textContent: '.geojson • .json' });

		new Input({
			type: 'file',
			accept: '.geojson,.json',
			style: { display: 'none' },
			dropZone,
			onFiles: ([file]) => this._processFile(file),
			appendTo: dropZone,
		});

		this._previewSection = new Component({ appendTo: this.body });
	}

	async _processFile(file) {
		try {
			const text = await file.text();
			const geojson = JSON.parse(text);

			let features;
			if (geojson.type === 'FeatureCollection') {
				features = geojson.features;
			} else if (geojson.type === 'Feature') {
				features = [geojson];
			} else {
				features = [{ type: 'Feature', geometry: geojson, properties: {} }];
			}

			const polygons = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');

			if (!polygons.length) {
				new Notify({ intent: 'danger', textContent: 'No polygon features found in this file', timeout: 4000 });

				return;
			}

			this._pendingFeatures = polygons;
			this._renderPreview(polygons);
		} catch {
			new Notify({
				intent: 'danger',
				textContent: 'Could not parse file — make sure it is valid GeoJSON',
				timeout: 4000,
			});
		}
	}

	_renderPreview(features) {
		this._previewSection.empty();

		new Elem({
			tag: 'p',
			appendTo: this._previewSection,
			style: { fontSize: '13px', margin: `${space.md} 0 ${space.sm}` },
			textContent: `Found ${features.length} polygon${features.length !== 1 ? 's' : ''}:`,
		});

		const list = new PreviewList({ appendTo: this._previewSection, style: { fontSize: '13px' } });

		for (const [i, feature] of features.entries()) {
			const props = feature.properties || {};
			const name = props.name || props.NAME || props.FIELD_NAME || props.label || `Feature ${i + 1}`;

			new Elem({ tag: 'div', appendTo: list, textContent: `${i + 1}. ${name}` });
		}

		new Button({
			appendTo: this._previewSection,
			textContent: `Import All ${features.length} Fields`,
			style: { marginTop: space.xs, width: '100%' },
			onPointerPress: () => {
				this.options.onImport?.(this._pendingFeatures);
				this.close();
			},
		});
	}
}
