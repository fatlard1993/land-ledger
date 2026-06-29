import { Dialog, Component, Elem, Button, Notify } from '@vanilla-bean/components';
import { styled } from '@vanilla-bean/components';

const DropZone = styled(
	Component,
	({ colors }) => `
		border: 2px dashed ${colors.gray};
		border-radius: 8px;
		padding: 32px 16px;
		text-align: center;
		cursor: pointer;
		color: ${colors.gray};
		transition: border-color 0.15s, color 0.15s;
		margin: 8px 0;

		&.drag-over {
			border-color: ${colors.light(colors.green)};
			color: ${colors.light(colors.green)};
		}

		& .drop-icon {
			font-size: 36px;
			margin-bottom: 8px;
		}

		& .drop-label {
			font-size: 14px;
		}

		& .drop-sub {
			font-size: 12px;
			margin-top: 4px;
		}
	`,
);

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

		new Elem({
			tag: 'p',
			appendTo: this.body,
			style: { fontSize: '13px', color: 'var(--color-medium)', margin: '0 0 4px' },
			textContent: 'Import a GeoJSON file exported from farmers.gov, FieldView, or any GIS tool.',
		});

		const dropZone = new DropZone({ appendTo: this.body });

		const fileInput = new Elem({
			tag: 'input',
			appendTo: dropZone,
			attributes: { type: 'file', accept: '.geojson,.json', style: 'display:none' },
		});

		new Elem({ tag: 'div', appendTo: dropZone, addClass: 'drop-icon', textContent: '📁' });
		new Elem({
			tag: 'div',
			appendTo: dropZone,
			addClass: 'drop-label',
			textContent: 'Drop GeoJSON file here or tap to browse',
		});
		new Elem({ tag: 'div', appendTo: dropZone, addClass: 'drop-sub', textContent: '.geojson • .json' });

		dropZone.onPointerPress(() => fileInput.elem.click());
		dropZone.elem.addEventListener('dragover', e => {
			e.preventDefault();
			dropZone.addClass('drag-over');
		});
		dropZone.elem.addEventListener('dragleave', () => dropZone.removeClass('drag-over'));
		dropZone.elem.addEventListener('drop', e => {
			e.preventDefault();
			dropZone.removeClass('drag-over');
			const file = e.dataTransfer?.files?.[0];

			if (file) this._processFile(file);
		});

		fileInput.elem.addEventListener('change', () => {
			const file = fileInput.elem.files?.[0];

			if (file) this._processFile(file);
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
				new Notify({ type: 'error', textContent: 'No polygon features found in this file', timeout: 4000 });

				return;
			}

			this._pendingFeatures = polygons;
			this._renderPreview(polygons);
		} catch {
			new Notify({ type: 'error', textContent: 'Could not parse file — make sure it is valid GeoJSON', timeout: 4000 });
		}
	}

	_renderPreview(features) {
		this._previewSection.empty();

		new Elem({
			tag: 'p',
			appendTo: this._previewSection,
			style: { fontSize: '13px', margin: '12px 0 6px' },
			textContent: `Found ${features.length} polygon${features.length !== 1 ? 's' : ''}:`,
		});

		const list = new Component({
			appendTo: this._previewSection,
			style: { maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-dark)', borderRadius: '6px' },
		});

		for (const [i, feature] of features.entries()) {
			const props = feature.properties || {};
			const name = props.name || props.NAME || props.FIELD_NAME || props.label || `Feature ${i + 1}`;

			new Elem({
				tag: 'div',
				appendTo: list,
				style: { padding: '6px 10px', borderBottom: '1px solid var(--color-dark)', fontSize: '13px' },
				textContent: `${i + 1}. ${name}`,
			});
		}

		new Button({
			appendTo: this._previewSection,
			textContent: `Import All ${features.length} Fields`,
			style: { marginTop: '12px', width: '100%' },
			onPointerPress: () => {
				this.options.onImport?.(this._pendingFeatures);
				this.close();
			},
		});
	}
}
