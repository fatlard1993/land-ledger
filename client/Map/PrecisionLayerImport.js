import {
	Button,
	Component,
	Dialog,
	EmptyState,
	Form,
	Icon,
	Input,
	Notify,
	SectionLabel,
	Select,
	styled,
	Table,
	theme,
} from '@vanilla-bean/components';
import { getFields } from '../api';
import { previewPrecisionFile, importPrecisionLayer } from '../api/precisionLayers';

const { space } = theme;

const DropZone = styled(
	Component,
	({ colors, radius, space }) => `
		border: 2px dashed ${colors.alpha(colors.white, 0.2)};
		border-radius: ${radius.lg};
		padding: 28px 16px;
		text-align: center;
		cursor: pointer;
		color: ${colors.muted};
		transition: border-color 0.15s;

		& .drop-icon {
			margin-bottom: ${space.sm};
			font-size: 28px;
		}

		& .drop-title {
			font-size: 14px;
		}

		& .drop-hint {
			margin-top: ${space.xs};
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
		color: ${colors.muted};
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
			style: { margin: `0 0 ${space.md}` },
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
			new Notify({ intent: 'danger', textContent: err.message || 'Could not parse file' });
			this._renderUpload();
			return;
		}

		this._renderConfig(file, preview);
	}

	async _renderConfig(file, preview) {
		this.body.empty();

		new Note({
			appendTo: this.body,
			style: { marginBottom: space.md },
			textContent: `${file.name}  ·  ${preview.rowCount ?? '?'} rows  ·  ${preview.columns.length} columns`,
		});

		const body = this.body;

		// Sample preview: the first rows under the file's own columns
		if (preview.sample?.length) {
			const columns = preview.columns.slice(0, 6);

			new SectionLabel({ appendTo: body, textContent: 'Preview (first 3 rows)' });
			new Table({
				appendTo: body,
				style: { marginBottom: space.md, fontSize: '11px' },
				columns: columns.map(col => ({ key: col, content: col })),
				data: preview.sample.map(row =>
					Object.fromEntries(columns.map(col => [col, String(row[col] ?? '').slice(0, 20)])),
				),
			});
		}

		// The most likely value column, picked to start with
		const valueGuess = preview.columns.find(c => /yield|rate|bu|ton|lb|seed|appli|actual|target/i.test(c));
		const notLinked = { value: '', label: '— not linked —' };

		const form = new Form({
			appendTo: body,
			data: {
				valueField: valueGuess || preview.columns[0] || '',
				valueUnit: '',
				layerType: 'yield',
				season: new Date().getFullYear(),
				fieldId: '',
				crop: '',
			},
			inputs: [
				{
					key: 'valueField',
					label: 'Data value column *',
					InputComponent: Select,
					options: preview.columns.map(c => ({ value: c, label: c })),
					validate: value => (value ? null : 'Select a value column'),
				},
				{ key: 'valueUnit', label: 'Value unit (e.g. bu/ac, seeds/ac)', placeholder: 'bu/ac' },
				// Type + season
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.md },
					inputs: [
						{
							key: 'layerType',
							label: 'Layer type',
							InputComponent: Select,
							options: [
								{ value: 'yield', label: 'Yield map' },
								{ value: 'as-applied', label: 'As-applied map' },
								{ value: 'soil-ec', label: 'Soil EC map' },
								{ value: 'other', label: 'Other data layer' },
							],
						},
						{ key: 'season', label: 'Season', type: 'number' },
					],
				},
				{
					key: 'fieldId',
					label: 'Field (optional — link to a specific field)',
					InputComponent: Select,
					options: [notLinked],
				},
				{ key: 'crop', label: 'Crop (optional)', placeholder: 'e.g. Corn, Winter Wheat' },
			],
		});
		// What each field holds as it's typed, ahead of the change that leaving it makes
		const value = key => form.inputElements[key].options.value;

		getFields()
			.then(d => {
				form.inputElements.fieldId.options.options = [
					notLinked,
					...Object.values(d?.body || {})
						.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
						.map(f => ({ value: f.id, label: f.name || 'Unnamed' })),
				];
				if (this.options.presetFieldId) {
					form.options.data.fieldId = form.inputElements.fieldId.options.value = this.options.presetFieldId;
				}
			})
			.catch(() => {});

		// Import button
		const importBtn = new Button({
			appendTo: body,
			textContent: 'Import layer',
			style: { width: '100%', marginTop: space.lg },
			onPointerPress: async () => {
				if (form.hasErrors()) return;

				const valueField = value('valueField');

				importBtn.options.disabled = true;
				importBtn.elem.textContent = 'Importing…';

				try {
					const result = await importPrecisionLayer({
						file,
						fieldId: value('fieldId') || null,
						type: value('layerType'),
						valueField,
						valueUnit: value('valueUnit').trim(),
						season: Number(value('season')),
						crop: value('crop').trim(),
					});

					new Notify({
						intent: 'success',
						textContent: `Imported ${result.originalCount?.toLocaleString()} points (stored ${result.points?.length?.toLocaleString()} after sampling) · mean ${result.stats?.mean} ${result.stats?.cv !== undefined ? `· CV ${result.stats.cv}%` : ''}`,
						timeout: 6000,
					});

					this.options.onImport?.(result);
					this.close();
				} catch (err) {
					new Notify({ intent: 'danger', textContent: err.message || 'Import failed' });
					importBtn.options.disabled = false;
					importBtn.elem.textContent = 'Import layer';
				}
			},
		});

		new Button({
			appendTo: body,
			variant: 'flat',
			icon: 'arrow-left',
			textContent: 'Choose different file',
			style: { width: '100%', marginTop: space.sm, fontSize: '12px' },
			onPointerPress: () => this._renderUpload(),
		});
	}
}
