import {
	Button,
	Component,
	Dialog,
	Elem,
	EmptyState,
	Icon,
	Input,
	Notify,
	Select,
	styled,
} from '@vanilla-bean/components';
import { getFields } from '../api';
import { previewPrecisionFile, importPrecisionLayer } from '../api/precisionLayers';
import { FormLabel } from '../Layout';
import { FigureTable } from './panelParts';

const DropZone = styled(
	Component,
	({ colors, radius }) => `
		border: 2px dashed ${colors.alpha(colors.white, 0.2)};
		border-radius: ${radius.lg};
		padding: 28px 16px;
		text-align: center;
		cursor: pointer;
		color: ${colors.gray};
		transition: border-color 0.15s;

		& .drop-icon {
			margin-bottom: 6px;
			font-size: 28px;
		}

		& .drop-title {
			font-size: 14px;
		}

		& .drop-hint {
			margin-top: 4px;
			font-size: 11px;
		}

		&.drag-over {
			border-color: ${colors.alpha(colors.info, 0.6)};
		}
	`,
);

const Note = styled(
	Component,
	({ colors }) => `
		font-size: 13px;
		color: ${colors.gray};
	`,
);

export default class PrecisionLayerImport extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Import Precision Layer',
			buttons: ['Cancel'],
			onButtonPress: () => this.close(),
			...options,
		});
		this._renderUpload();
	}

	_renderUpload() {
		this.body.empty();

		new Note({
			tag: 'p',
			appendTo: this.body,
			style: { margin: '0 0 10px' },
			textContent:
				'Import yield maps and as-applied maps from combine or planter monitors. Accepts CSV (with Lat/Lon columns) or GeoJSON with Point features.',
		});

		const dropZone = new DropZone({ appendTo: this.body });
		new Icon({ appendTo: dropZone, addClass: 'drop-icon', icon: 'file-import' });
		new Component({
			appendTo: dropZone,
			addClass: 'drop-title',
			textContent: 'Drop CSV or GeoJSON file here, or tap to browse',
		});
		new Component({ appendTo: dropZone, addClass: 'drop-hint', textContent: '.csv  ·  .json  ·  .geojson' });

		new Input({
			type: 'file',
			accept: '.csv,.json,.geojson',
			style: { display: 'none' },
			dropZone,
			onFiles: ([file]) => this._loadFile(file),
			appendTo: this.body,
		});
	}

	async _loadFile(file) {
		this.body.empty();
		new EmptyState({ appendTo: this.body, loading: true, message: `Parsing ${file.name}…` });

		let preview;
		try {
			preview = await previewPrecisionFile(file);
		} catch (err) {
			new Notify({ type: 'error', textContent: err.message || 'Could not parse file', timeout: 5000 });
			this._renderUpload();
			return;
		}

		this._renderConfig(file, preview);
	}

	async _renderConfig(file, preview) {
		this.body.empty();

		new Note({
			appendTo: this.body,
			style: { marginBottom: '12px' },
			textContent: `${file.name}  ·  ${preview.rowCount ?? '?'} rows  ·  ${preview.columns.length} columns`,
		});

		const body = this.body;

		// Value column
		new FormLabel({ appendTo: body, textContent: 'Data value column *' });
		const valueSelect = new Select({ appendTo: body });
		for (const { value: v, label: l } of preview.columns.map(c => ({ value: c, label: c }))) {
			const o = document.createElement('option');
			o.value = v;
			o.textContent = l;
			valueSelect.elem.append(o);
		}
		valueSelect.elem.value = preview.columns[0] || '';

		// Auto-select the most likely value column
		const valueGuess = preview.columns.find(c => /yield|rate|bu|ton|lb|seed|appli|actual|target/i.test(c));
		if (valueGuess) valueSelect.elem.value = valueGuess;

		new FormLabel({ appendTo: body, textContent: 'Value unit (e.g. bu/ac, seeds/ac)' });
		const unitInput = new Input({ appendTo: body });
		unitInput.elem.type = 'text';
		unitInput.elem.placeholder = 'bu/ac';

		// Sample preview table
		if (preview.sample?.length) {
			new FormLabel({ appendTo: body, textContent: 'Preview (first 3 rows)' });
			const table = new FigureTable({ appendTo: body, style: { marginTop: '4px', fontSize: '11px' } });
			const thead = new Elem({ tag: 'thead', appendTo: table });
			const hRow = new Elem({ tag: 'tr', appendTo: thead });
			for (const col of preview.columns.slice(0, 6)) {
				new Elem({ tag: 'th', appendTo: hRow, textContent: col });
			}
			const tbody = new Elem({ tag: 'tbody', appendTo: table });
			for (const row of preview.sample) {
				const tr = new Elem({ tag: 'tr', appendTo: tbody });
				for (const col of preview.columns.slice(0, 6)) {
					new Elem({ tag: 'td', appendTo: tr, textContent: String(row[col] ?? '').slice(0, 20) });
				}
			}
		}

		// Type + field + season
		const row1 = new Component({
			appendTo: body,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
		});
		const c1 = new Component({ appendTo: row1 });
		const c2 = new Component({ appendTo: row1 });

		new FormLabel({ appendTo: c1, textContent: 'Layer type' });
		const typeSelect = new Select({ appendTo: c1 });
		for (const { value: v, label: l } of [
			{ value: 'yield', label: 'Yield map' },
			{ value: 'as-applied', label: 'As-applied map' },
			{ value: 'soil-ec', label: 'Soil EC map' },
			{ value: 'other', label: 'Other data layer' },
		]) {
			const o = document.createElement('option');
			o.value = v;
			o.textContent = l;
			typeSelect.elem.append(o);
		}
		typeSelect.elem.value = 'yield';

		new FormLabel({ appendTo: c2, textContent: 'Season' });
		const seasonInput = new Input({ appendTo: c2 });
		seasonInput.elem.type = 'number';
		seasonInput.elem.value = new Date().getFullYear();

		new FormLabel({ appendTo: body, textContent: 'Field (optional — link to a specific field)' });
		const fieldSelect = new Select({ appendTo: body });
		const notLinkedOpt = document.createElement('option');
		notLinkedOpt.value = '';
		notLinkedOpt.textContent = '— not linked —';
		fieldSelect.elem.append(notLinkedOpt);
		getFields()
			.then(d => {
				Object.values(d?.body || {})
					.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
					.forEach(f => {
						fieldSelect.elem.append(new Option(f.name || 'Unnamed', f.id));
					});
				if (this.options.presetFieldId) fieldSelect.elem.value = this.options.presetFieldId;
			})
			.catch(() => {});

		new FormLabel({ appendTo: body, textContent: 'Crop (optional)' });
		const cropInput = new Input({ appendTo: body });
		cropInput.elem.type = 'text';
		cropInput.elem.placeholder = 'e.g. Corn, Winter Wheat';

		// Import button
		const importBtn = new Button({
			appendTo: body,
			textContent: 'Import Layer',
			style: { width: '100%', marginTop: '16px' },
			onPointerPress: async () => {
				const valueField = valueSelect.elem.value;
				if (!valueField) {
					new Notify({ type: 'warning', textContent: 'Select a value column', timeout: 3000 });
					return;
				}

				importBtn.elem.disabled = true;
				importBtn.elem.textContent = 'Importing…';

				try {
					const result = await importPrecisionLayer({
						file,
						fieldId: fieldSelect.elem.value || null,
						type: typeSelect.elem.value,
						valueField,
						valueUnit: unitInput.elem.value.trim(),
						season: Number(seasonInput.elem.value),
						crop: cropInput.elem.value.trim(),
					});

					new Notify({
						type: 'success',
						textContent: `Imported ${result.originalCount?.toLocaleString()} points (stored ${result.points?.length?.toLocaleString()} after sampling) · mean ${result.stats?.mean} ${result.stats?.cv !== undefined ? `· CV ${result.stats.cv}%` : ''}`,
						timeout: 6000,
					});

					this.options.onImport?.(result);
					this.close();
				} catch (err) {
					new Notify({ type: 'error', textContent: err.message || 'Import failed', timeout: 5000 });
					importBtn.elem.disabled = false;
					importBtn.elem.textContent = 'Import Layer';
				}
			},
		});

		new Button({
			appendTo: body,
			variant: 'flat',
			icon: 'arrow-left',
			textContent: 'Choose different file',
			style: { width: '100%', marginTop: '6px', fontSize: '12px' },
			onPointerPress: () => this._renderUpload(),
		});
	}
}
