import { FormDialog, Component, Elem, Select, Button, theme } from '@vanilla-bean/components';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { toNum } from '../utils/format.js';
import { watchFormConflicts } from '../utils/watchFormConflicts.js';
import { stayOpenFor } from '../utils/stayOpenFor';

const { colors } = theme;

export const FREQUENCIES = [
	{ value: 'daily', label: 'Daily', multiplier: 365 },
	{ value: 'weekly', label: 'Weekly', multiplier: 52 },
	{ value: 'biweekly', label: 'Every 2 weeks', multiplier: 26 },
	{ value: 'monthly', label: 'Monthly', multiplier: 12 },
	{ value: 'bimonthly', label: 'Every 2 months', multiplier: 6 },
	{ value: 'quarterly', label: 'Quarterly', multiplier: 4 },
	{ value: 'semiannual', label: 'Semi-annual', multiplier: 2 },
	{ value: 'annual', label: 'Annual', multiplier: 1 },
];

export const INCOME_CATEGORIES = [
	'Barn rental',
	'Storage rental',
	'Airbnb / short-term rental',
	'Event hosting',
	'Agri-tourism',
	'Equipment hire',
	'Crop share income',
	'Custom work income',
	'Other income',
];

export const EXPENSE_CATEGORIES = [
	'Electricity',
	'Water / irrigation',
	'Natural gas / propane',
	'Internet / phone',
	'Property taxes',
	'Property insurance',
	'Equipment insurance',
	'Liability insurance',
	'Loan / mortgage payment',
	'Equipment lease payment',
	'Seed subscription',
	'Software / services',
	'Employee / labor',
	'Contractor',
	'Other expense',
];

export const annualAmount = item => {
	const freq = FREQUENCIES.find(f => f.value === item.frequency) || FREQUENCIES[1];

	return (Number(item.amount) || 0) * freq.multiplier;
};

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

export default class BudgetItemDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.item?.id;
		const item = options.item || {};

		super({
			size: 'large',
			header: isEdit ? 'Edit Budget Item' : 'Add Budget Item',
			data: {
				name: item.name || '',
				category: item.category || '',
				amount: item.amount != null ? item.amount : '',
				frequency: item.frequency || 'monthly',
				startDate: item.startDate || '',
				endDate: item.endDate || '',
			},
			inputs: [
				{ key: 'name', label: 'Name', placeholder: 'e.g. Barn electricity, Monthly rental income' },
				{
					key: 'category',
					label: 'Category',
					placeholder: 'e.g. Utilities, Rental income, Insurance',
					suggestions: item.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES,
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{
							key: 'amount',
							label: 'Amount ($)',
							type: 'number',
							attributes: { step: '0.01' },
							placeholder: '0.00',
							onChange: () => updatePreview(),
						},
						{
							key: 'frequency',
							label: 'Frequency',
							InputComponent: Select,
							options: FREQUENCIES.map(({ value, label }) => ({ value, label })),
							onChange: () => updatePreview(),
						},
					],
				},
				{
					type: 'group',
					style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
					inputs: [
						{ key: 'startDate', label: 'Start Date (optional)', type: 'date' },
						{ key: 'endDate', label: 'End Date (optional)', type: 'date' },
					],
				},
			],
			onSave: async d => {
				return stayOpenFor(
					await options.onSave?.({
						name: d.name,
						type: typeSelect.value,
						category: d.category,
						amount: toNum(d.amount),
						frequency: d.frequency,
						entityType: options.entityType || item.entityType || '',
						entityId: options.entity?.id || item.entityId || '',
						entityName: options.entity?.name || item.entityName || '',
						startDate: d.startDate || null,
						endDate: d.endDate || null,
						properties: collectProps(),
					}),
				);
			},
			...(isEdit && {
				onDelete: async () => stayOpenFor(await options.onDelete?.()),
				confirmDelete: { header: `Delete "${item.name || 'this budget item'}"?` },
			}),
			...withoutCallbacks(options),
		});

		// Type toggle
		const typeRow = new Component({
			appendTo: this.intro,
			style: { display: 'flex', gap: '6px', marginBottom: '4px' },
		});
		const makeType = (icon, label, value) => {
			const btn = new Button({
				variant: 'chip',
				icon,
				textContent: label,
				style: { flex: '1' },
				appendTo: typeRow,
				onPointerPress: () => {
					typeSelect.value = value;
					updateTypeStyle();
				},
			});

			btn.elem.type = 'button';
			btn.elem.dataset.val = value;

			return btn;
		};

		const incBtn = makeType('arrow-trend-up', 'Income', 'income');
		const expBtn = makeType('arrow-trend-down', 'Expense', 'expense');
		const typeSelect = { value: item.type || 'expense' };

		const updateTypeStyle = () => {
			for (const btn of [incBtn, expBtn]) {
				btn.toggleClass('active', btn.elem.dataset.val === typeSelect.value);
			}

			// Category suggestions follow the type
			this.form.inputElements.category.options.suggestions =
				typeSelect.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
		};

		const preview = new Elem({
			tag: 'div',
			style: { fontSize: '11px', color: colors.gray, marginTop: '6px' },
		});

		const updatePreview = () => {
			const amt = Number(this.form.options.data.amount);
			const freq = FREQUENCIES.find(f => f.value === this.form.options.data.frequency);

			preview.elem.textContent = amt && freq ? `= $${(amt * freq.multiplier).toFixed(0)}/year` : '';
		};

		this.body.append(preview);

		if (isEdit) this.form.addCleanup('conflictWatch', watchFormConflicts(this.form, 'budget-items', item.id));

		// Initialize suggestions and preview
		updateTypeStyle();
		updatePreview();

		const { collect: collectProps } = makePropertiesEditor(this.body, item.properties || {});

		if (options.entity) {
			new Elem({
				tag: 'div',
				style: { fontSize: '11px', color: colors.gray, marginTop: '10px' },
				textContent: `Linked to: ${options.entity.name || options.entityType}`,
				appendTo: this.body,
			});
		}
	}
}
