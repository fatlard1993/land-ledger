import { Dialog, Component, Elem, Button, Notify } from '@vanilla-bean/components';
import { getFields } from '../api';
import { previewPrecisionFile, importPrecisionLayer } from '../api/precisionLayers';
import { FormLabel, FormInput, FormSelect } from '../Layout';

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

		new Elem({
			tag: 'p',
			appendTo: this.body,
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' },
			textContent:
				'Import yield maps and as-applied maps from combine or planter monitors. Accepts CSV (with Lat/Lon columns) or GeoJSON with Point features.',
		});

		const dropZone = new Elem({
			tag: 'div',
			appendTo: this.body,
			style: {
				border: '2px dashed rgba(255,255,255,0.2)',
				borderRadius: '8px',
				padding: '28px 16px',
				textAlign: 'center',
				cursor: 'pointer',
				color: 'rgba(255,255,255,0.4)',
				transition: 'border-color 0.15s',
			},
		});
		dropZone.elem.innerHTML =
			'<div style="font-size:28px;margin-bottom:6px">📡</div><div style="font-size:14px">Drop CSV or GeoJSON file here, or tap to browse</div><div style="font-size:11px;margin-top:4px">.csv &nbsp;·&nbsp; .json &nbsp;·&nbsp; .geojson</div>';

		const fileInput = new Elem({ tag: 'input', appendTo: this.body });
		fileInput.elem.type = 'file';
		fileInput.elem.accept = '.csv,.json,.geojson';
		fileInput.elem.style.display = 'none';

		const over = () => {
			dropZone.elem.style.borderColor = 'rgba(74,144,217,0.6)';
		};
		const out = () => {
			dropZone.elem.style.borderColor = 'rgba(255,255,255,0.2)';
		};
		dropZone.elem.addEventListener('click', () => fileInput.elem.click());
		dropZone.elem.addEventListener('dragover', e => {
			e.preventDefault();
			over();
		});
		dropZone.elem.addEventListener('dragleave', out);
		dropZone.elem.addEventListener('drop', e => {
			e.preventDefault();
			out();
			const f = e.dataTransfer?.files?.[0];
			if (f) this._loadFile(f);
		});
		fileInput.elem.addEventListener('change', () => {
			const f = fileInput.elem.files?.[0];
			if (f) this._loadFile(f);
		});
	}

	async _loadFile(file) {
		this.body.empty();
		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' },
			textContent: `Parsing ${file.name}…`,
		});

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

		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' },
			textContent: `${file.name}  ·  ${preview.rowCount ?? '?'} rows  ·  ${preview.columns.length} columns`,
		});

		const body = this.body;

		// Value column
		new FormLabel({ appendTo: body, textContent: 'Data value column *' });
		const valueSelect = new FormSelect({ appendTo: body });
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
		const unitInput = new FormInput({ appendTo: body });
		unitInput.elem.type = 'text';
		unitInput.elem.placeholder = 'bu/ac';

		// Sample preview table
		if (preview.sample?.length) {
			new FormLabel({ appendTo: body, textContent: 'Preview (first 3 rows)' });
			const table = new Elem({ tag: 'table', appendTo: body });
			table.elem.style.cssText = 'width:100%;font-size:11px;border-collapse:collapse;margin-top:4px;';
			const thead = new Elem({ tag: 'thead', appendTo: table });
			const hRow = new Elem({ tag: 'tr', appendTo: thead });
			for (const col of preview.columns.slice(0, 6)) {
				const th = new Elem({ tag: 'th', appendTo: hRow, textContent: col });
				th.elem.style.cssText =
					'text-align:left;padding:4px 6px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.08);';
			}
			const tbody = new Elem({ tag: 'tbody', appendTo: table });
			for (const row of preview.sample) {
				const tr = new Elem({ tag: 'tr', appendTo: tbody });
				for (const col of preview.columns.slice(0, 6)) {
					const td = new Elem({ tag: 'td', appendTo: tr, textContent: String(row[col] ?? '').slice(0, 20) });
					td.elem.style.cssText =
						'padding:3px 6px;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.05);';
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
		const typeSelect = new FormSelect({ appendTo: c1 });
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
		const seasonInput = new FormInput({ appendTo: c2 });
		seasonInput.elem.type = 'number';
		seasonInput.elem.value = new Date().getFullYear();

		new FormLabel({ appendTo: body, textContent: 'Field (optional — link to a specific field)' });
		const fieldSelect = new FormSelect({ appendTo: body });
		const notLinkedOpt = document.createElement('option');
		notLinkedOpt.value = '';
		notLinkedOpt.textContent = '— not linked —';
		fieldSelect.elem.append(notLinkedOpt);
		getFields()
			.then(d => {
				Object.values(d?.body || {})
					.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
					.forEach(f => {
						const o = new Option(f.name || 'Unnamed', f.id);
						o.style.background = '#1a1a1a';
						fieldSelect.elem.append(o);
					});
				if (this.options.presetFieldId) fieldSelect.elem.value = this.options.presetFieldId;
			})
			.catch(() => {});

		new FormLabel({ appendTo: body, textContent: 'Crop (optional)' });
		const cropInput = new FormInput({ appendTo: body });
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
			textContent: '← Choose different file',
			style: { width: '100%', marginTop: '6px', fontSize: '12px' },
			onPointerPress: () => this._renderUpload(),
		});
	}
}
