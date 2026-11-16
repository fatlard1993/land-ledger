import {
	Button,
	Component,
	Content,
	Dialog,
	Elem,
	EmptyState,
	Form,
	Icon,
	Input,
	Notify,
	Select,
	styled,
	theme,
} from '@vanilla-bean/components';

import {
	parseTabularFile,
	applyTabularImport,
	getImportTemplates,
	saveImportTemplate,
	deleteImportTemplate,
} from '../api/tabularImport';

const { colors, space } = theme;

const DropZone = styled(
	Component,
	({ colors, radius }) => `
		border: 2px dashed ${colors.gray};
		border-radius: ${radius.lg};
		padding: 28px 16px;
		text-align: center;
		cursor: pointer;
		color: ${colors.muted};
		transition: border-color 0.15s, color 0.15s;

		&.drag-over {
			border-color: ${colors.light(colors.green)};
			color: ${colors.light(colors.green)};
		}
	`,
);

const MapRow = styled(
	Component,
	({ colors, space }) => `
		display: grid;
		grid-template-columns: 1fr 28px 1fr;
		align-items: center;
		gap: ${space.sm};
		padding: ${space.sm} 0;
		border-bottom: 1px solid ${colors.border};
		font-size: 13px;

		& .col-source {
			font-weight: 500;
			color: ${colors.white};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		& .col-arrow {
			text-align: center;
			color: ${colors.muted};
			font-size: 11px;
		}

		& select {
			font-size: 12px;
			padding: ${space.xs} ${space.sm};
		}
	`,
);

const MapHeader = styled(
	Component,
	({ colors, space }) => `
		display: grid;
		grid-template-columns: 1fr 28px 1fr;
		gap: ${space.sm};
		padding: ${space.xs} 0;
		margin-bottom: ${space.xs};
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: ${colors.muted};
	`,
);

const Intro = styled(
	Component,
	({ colors, space }) => `
		margin: 0 0 ${space.md};
		font-size: 13px;
		color: ${colors.muted};
	`,
	{ tag: 'p' },
);

const COLLECTIONS = {
	events: {
		label: 'Events / Timeline',
		fields: [
			{ value: 'date', label: 'Date', patterns: /^date$|^sample.?date$|^dated?$/i },
			{ value: 'season', label: 'Season (year)', patterns: /^year$|^season$/i },
			{ value: 'category', label: 'Category', patterns: /^category$|^event.?type$/i },
			{ value: 'name', label: 'Name / Description', patterns: /^name$|^description$|^event.?name$/i },
			{ value: 'notes', label: 'Notes', patterns: /^notes?$|^comments?$/i },
		],
	},
	supplies: {
		label: 'Supplies / Inventory',
		fields: [
			{ value: 'name', label: 'Item Name', patterns: /^name$|^item$|^product$/i },
			{ value: 'category', label: 'Category', patterns: /^category$|^type$/i },
			{ value: 'unit', label: 'Unit', patterns: /^units?$/i },
			{ value: 'costPerUnit', label: 'Cost per Unit', patterns: /^cost|^price.?per.?unit$/i },
			{ value: 'currentStock', label: 'Current Stock', patterns: /^qty$|^quantity$|^stock$|^on.?hand$/i },
			{ value: 'notes', label: 'Notes', patterns: /^notes?$|^comments?$/i },
		],
	},
	revenue: {
		label: 'Revenue',
		fields: [
			{ value: 'date', label: 'Date', patterns: /^date$/i },
			{ value: 'amount', label: 'Amount ($)', patterns: /^amount$|^total$|^revenue$/i },
			{ value: 'type', label: 'Type', patterns: /^type$|^category$/i },
			{ value: 'description', label: 'Description', patterns: /^description$|^detail$/i },
			{ value: 'notes', label: 'Notes', patterns: /^notes?$|^comments?$/i },
		],
	},
	maintenance: {
		label: 'Maintenance Records',
		fields: [
			{ value: 'date', label: 'Date', patterns: /^date$|^service.?date$/i },
			{ value: 'type', label: 'Work Type', patterns: /^type$|^work.?type$|^service.?type$/i },
			{ value: 'cost', label: 'Cost ($)', patterns: /^cost$|^amount$/i },
			{ value: 'parts', label: 'Parts Used', patterns: /^parts?$/i },
			{ value: 'procedure', label: 'Procedure', patterns: /^procedure$|^notes?$|^description$/i },
		],
	},
};

const autoDetect = (colName, collectionKey) => {
	const fields = COLLECTIONS[collectionKey]?.fields ?? [];

	for (const f of fields) {
		if (f.patterns?.test(colName)) return f.value;
	}

	return '_properties';
};

export default class TabularImportDialog extends Dialog {
	constructor(options = {}) {
		super({
			size: 'large',
			header: 'Import CSV / JSON',
			buttons: ['Cancel'],
			onButtonPress: () => this.close(),
			...options,
		});

		this._rows = [];
		this._columns = [];
		this._mapping = {};
		this._collection = options.initialCollection ?? 'events';

		this._renderUpload();
	}

	_renderUpload() {
		this.body.empty();

		new Intro({
			appendTo: this.body,
			textContent:
				"Import a CSV or JSON file into any collection. Columns you don't map go into free-form Properties — nothing is discarded.",
		});

		const dropZone = new DropZone({ appendTo: this.body });

		new Icon({
			appendTo: dropZone,
			icon: 'folder-open',
			style: { display: 'block', fontSize: '32px', marginBottom: space.sm },
		});
		new Elem({
			tag: 'div',
			appendTo: dropZone,
			style: { fontSize: '14px', marginBottom: space.xs },
			textContent: 'Drop CSV or JSON file here, or tap to browse',
		});
		new Elem({ tag: 'div', appendTo: dropZone, style: { fontSize: '12px' }, textContent: '.csv • .json' });

		new Input({
			type: 'file',
			accept: '.csv,.json,.tsv',
			style: { display: 'none' },
			dropZone,
			onFiles: ([file]) => this._loadFile(file),
			appendTo: dropZone,
		});
	}

	async _loadFile(file) {
		this.body.empty();

		new EmptyState({ appendTo: this.body, loading: true, title: `Parsing ${file.name}…` });

		try {
			const result = await parseTabularFile(file);

			this._columns = result.columns;
			this._rows = result.rows;
			this._buildMapping();
			this._renderMapper();
		} catch (error) {
			new Notify({ intent: 'danger', textContent: error.message || 'Could not parse file' });
			this._renderUpload();
		}
	}

	_buildMapping() {
		this._mapping = {};

		for (const col of this._columns) {
			this._mapping[col] = autoDetect(col, this._collection);
		}
	}

	async _renderMapper() {
		this.body.empty();

		// Load saved templates async — renders after
		const templates = await getImportTemplates().catch(() => []);

		if (!this.body.elem.isConnected) return;

		// File summary
		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '13px', color: colors.muted, marginBottom: space.md },
			textContent: `${this._rows.length} row${this._rows.length !== 1 ? 's' : ''} · ${this._columns.length} column${this._columns.length !== 1 ? 's' : ''}`,
		});

		// Template picker (only if any templates saved)
		if (templates.length) {
			const templateForm = new Form({
				appendTo: this.body,
				data: { template: '' },
				inputs: [
					{
						key: 'template',
						label: 'Load saved template',
						InputComponent: Select,
						options: [{ value: '', label: '— select template —' }, ...templates.map(t => t.name)],
					},
				],
			});
			const templateSelect = templateForm.inputElements.template;

			const tplRow = new Component({
				appendTo: this.body,
				style: { display: 'flex', justifyContent: 'flex-end', gap: space.sm, marginBottom: space.md },
			});

			new Button({
				appendTo: tplRow,
				textContent: 'Load',
				style: { flexShrink: '0' },
				onPointerPress: () => {
					const tpl = templates.find(t => t.name === templateSelect.options.value);

					if (!tpl) return;

					this._collection = tpl.collection;
					this._mapping = { ...tpl.mapping };
					this._renderMapper();
				},
			});

			new Button({
				appendTo: tplRow,
				variant: 'flat',
				icon: 'xmark',
				title: 'Delete selected template',
				intent: 'danger',
				style: { flexShrink: '0' },
				onPointerPress: async () => {
					if (!templateSelect.options.value) return;

					if (
						!(await Dialog.confirm({
							header: `Delete the "${templateSelect.options.value}" template?`,
							confirmLabel: 'Delete',
							intent: 'danger',
						}))
					)
						return;

					try {
						await deleteImportTemplate(templateSelect.options.value);
					} catch (error) {
						new Notify({ intent: 'danger', content: `Couldn't delete the template: ${error.message}` });
						return;
					}

					this._renderMapper();
				},
			});
		}

		// Collection picker
		new Form({
			appendTo: this.body,
			style: { marginBottom: space.md },
			data: { collection: this._collection },
			inputs: [
				{
					key: 'collection',
					label: 'Import into',
					InputComponent: Select,
					options: Object.entries(COLLECTIONS).map(([key, { label }]) => ({ value: key, label })),
					// Another collection maps the columns to its own fields
					onChange: ({ value }) => {
						this._collection = value;
						this._buildMapping();
						mapList.empty();
						this._renderMapRows(mapList);
						this._updateImportBtn();
					},
				},
			],
		});

		// Column mapper header
		const mapHeader = new MapHeader({ appendTo: this.body });

		new Elem({ tag: 'div', appendTo: mapHeader, textContent: 'Source Column' });
		new Elem({ tag: 'div', appendTo: mapHeader });
		new Elem({ tag: 'div', appendTo: mapHeader, textContent: 'Maps To' });

		// The mapper list, which the dialog's body scrolls with the rest
		const mapList = new Content({ appendTo: this.body, style: { marginBottom: space.md } });

		this._selectRefs = {};
		this._renderMapRows(mapList);

		// Import button
		this._importBtn = new Button({
			appendTo: this.body,
			// The label carries both counts, so it can outgrow a phone; it wraps rather than overflow
			style: { width: '100%', whiteSpace: 'normal' },
			onPointerPress: () => this._doImport(),
		});

		this._updateImportBtn();
	}

	_renderMapRows(container) {
		const fields = COLLECTIONS[this._collection]?.fields ?? [];

		for (const col of this._columns) {
			const row = new MapRow({ appendTo: container });

			new Elem({ tag: 'div', appendTo: row, addClass: 'col-source', textContent: col, title: col });
			new Elem({ tag: 'div', appendTo: row, addClass: 'col-arrow', textContent: '→' });

			const selectEl = new Select({
				appendTo: row,
				attributes: { 'aria-label': `Import ${col} as` },
				options: [
					{ label: 'Known fields', options: fields.map(({ value, label }) => ({ value, label })) },
					{
						label: 'Other',
						options: [
							{ value: '_properties', label: 'Properties (free-form)' },
							{ value: '_skip', label: 'Skip' },
						],
					},
				],
			});

			selectEl.options.value = this._mapping[col] ?? '_properties';
			selectEl.elem.addEventListener('change', () => {
				this._mapping[col] = selectEl.options.value;
				this._updateImportBtn();
			});

			this._selectRefs[col] = selectEl.elem;
		}
	}

	_updateImportBtn() {
		if (!this._importBtn) return;

		const count = this._rows.length;
		const mapped = Object.values(this._mapping).filter(v => v !== '_skip').length;

		this._importBtn.elem.textContent =
			count > 0
				? `Import ${count} Record${count !== 1 ? 's' : ''} (${mapped} column${mapped !== 1 ? 's' : ''} mapped)`
				: 'No rows to import';
		this._importBtn.options.disabled = count === 0;
	}

	_finishAndRefresh() {
		this.close();
		window.location.reload();
	}

	async _doImport() {
		if (!this._rows.length) return;

		this._importBtn.options.disabled = true;
		this._importBtn.elem.textContent = 'Importing…';

		try {
			const result = await applyTabularImport({
				collection: this._collection,
				rows: this._rows,
				mapping: this._mapping,
			});

			const { created = 0, errors = 0 } = result;

			if (errors > 0) {
				new Notify({
					intent: 'warning',
					textContent: `Imported ${created} record${created !== 1 ? 's' : ''} — ${errors} row${errors !== 1 ? 's' : ''} failed`,
				});
			} else {
				new Notify({
					intent: 'success',
					textContent: `Imported ${created} record${created !== 1 ? 's' : ''}`,
					timeout: 4000,
				});
			}

			this.options.onImport?.({ collection: this._collection, created, errors });

			// Offer to save the mapping as a reusable template
			this._renderSaveTemplate();
		} catch (error) {
			new Notify({ intent: 'danger', textContent: error.message || 'Import failed' });
			this._importBtn.options.disabled = false;
			this._updateImportBtn();
		}
	}

	_renderSaveTemplate() {
		this.body.empty();

		new Elem({
			tag: 'div',
			appendTo: this.body,
			style: { fontSize: '14px', fontWeight: '600', marginBottom: space.sm, color: colors.white },
			textContent: 'Import complete',
		});

		new Intro({
			appendTo: this.body,
			style: { marginBottom: space.lg },
			textContent: 'Save this column mapping as a template to reuse it next time you import from the same source.',
		});

		const form = new Form({
			appendTo: this.body,
			style: { marginBottom: space.md },
			data: { name: '' },
			inputs: [
				{
					key: 'name',
					label: 'Template name',
					placeholder: 'e.g. Waypoint Analytical Soil Test',
					validate: value => (String(value ?? '').trim() ? null : 'Name the template'),
				},
			],
		});

		// Why the template didn't save, in the form it was saved from
		const failure = new Elem({
			appendTo: this.body,
			attributes: { role: 'alert' },
			style: { marginBottom: space.md, color: colors.light(colors.danger) },
		});

		const buttons = new Component({ appendTo: this.body, style: { display: 'flex', gap: space.sm } });

		new Button({
			appendTo: buttons,
			textContent: 'Save template',
			style: { flex: '1' },
			onPointerPress: async () => {
				if (form.hasErrors()) return;

				const name = form.inputElements.name.options.value.trim();

				failure.elem.textContent = '';

				try {
					await saveImportTemplate({ name, collection: this._collection, mapping: this._mapping });
				} catch (error) {
					failure.elem.textContent = `Could not save the template${error?.message ? `: ${error.message}` : ''}`;

					return;
				}

				new Notify({ intent: 'success', textContent: `Template "${name}" saved`, timeout: 3000 });
				this._finishAndRefresh();
			},
		});

		new Button({
			appendTo: buttons,
			textContent: 'Skip',
			style: { flex: '1' },
			onPointerPress: () => this._finishAndRefresh(),
		});
	}
}
