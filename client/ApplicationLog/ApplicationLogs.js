import { Button, EmptyState, formatDate, Icon, Table, theme, Toolbar } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getApplicationLogs, getFields } from '../api';
import { PageView } from '../Layout';
import context from '../context';
import ExportDialog from '../Export/ExportDialog';

import ApplicationLogDialog, { CATEGORIES } from './ApplicationLogDialog';

const { colors } = theme;

const catMeta = val => CATEGORIES.find(c => c.value === val) || CATEGORIES.at(-1);

export default class ApplicationLogs extends AsyncView {
	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Applications', gap: 8, wrap: false });

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'file-export' }),
			title: 'Export application records',
			onPointerPress: () => new ExportDialog(),
		});

		new Button({
			appendTo: this.toolbar,
			append: new Icon({ icon: 'plus' }),
			title: 'Log application',
			onPointerPress: () => this._openDialog(),
		});

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { _logs: getApplicationLogs, _fields: getFields };
	}

	_onData() {
		this._render();
	}

	_render() {
		this.content.empty();

		const all = Object.values(this._logs?.body || {}).sort((a, b) => new Date(b.date) - new Date(a.date));

		context.hasApplicationLogs = all.length > 0;

		if (!all.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'flask',
				title: 'No application records',
				message:
					'Log pesticide, herbicide, fertilizer, and fuel applications with EPA registration numbers and compliance data',
			});
			return;
		}

		const fieldMap = this._fields?.body || {};

		const data = all.map(log => ({
			...log,
			_date: formatDate(log.date) || '—',
			_rate: log.rate ? `${log.rate} ${log.rateUnit || ''}`.trim() : '—',
			_field: fieldMap[log.fieldId]?.name || '—',
		}));

		const onEdit = rowData => ({ onPointerPress: () => this._openDialog(rowData) });

		const columns = [
			{
				key: '_date',
				content: 'Date',
				dataColumn: ({ rowData }) => onEdit(rowData),
			},
			{
				key: 'category',
				content: 'Category',
				sort: true,
				dataColumn: ({ rowData }) => {
					const meta = catMeta(rowData.category);
					return {
						...onEdit(rowData),
						style: {
							color: meta.color,
							background: `${meta.color}22`,
							border: `1px solid ${meta.color}44`,
							borderRadius: '4px',
							padding: '2px 6px',
							fontSize: '11px',
							fontWeight: '500',
							display: 'inline-block',
						},
					};
				},
			},
			{
				key: 'product',
				content: 'Product',
				sort: true,
				dataColumn: ({ rowData }) => ({
					...onEdit(rowData),
					style: { fontWeight: '600', color: colors.white },
					title: rowData.epaRegNumber ? `EPA ${rowData.epaRegNumber}` : undefined,
				}),
			},
			{
				key: '_rate',
				content: 'Rate',
				dataColumn: ({ rowData }) => onEdit(rowData),
			},
			{
				key: '_field',
				content: 'Field',
				sort: true,
				dataColumn: ({ rowData }) => onEdit(rowData),
			},
		];

		new Table({
			appendTo: this.content,
			columns,
			data,
			styles: ({ colors }) => `
				width: 100%;
				border-collapse: collapse;

				th {
					font-size: 10px;
					text-transform: uppercase;
					letter-spacing: .06em;
					color: ${colors.gray};
					padding: 4px 0 6px;
					border-bottom: 1px solid ${colors.border};
					text-align: left;
					font-weight: 500;
				}
				td {
					padding: 8px 0;
					border-bottom: 1px solid ${colors.border};
					vertical-align: middle;
					font-size: 12px;
					color: ${colors.muted};
					cursor: pointer;
				}
				tr:hover td { background: ${colors.alpha(colors.white, 0.03)}; }
			`,
		});
	}

	_openDialog(log = null) {
		new ApplicationLogDialog({
			record: log || undefined,
			onSave: result => {
				if (result && this._logs?.body) {
					this._logs.body[result.id] = result;
					context.hasApplicationLogs = true;
				}
				this._render();
			},
			onDelete: () => {
				if (this._logs?.body && log) delete this._logs.body[log.id];
				context.hasApplicationLogs = Object.keys(this._logs?.body || {}).length > 0;
				this._render();
			},
		});
	}
}
