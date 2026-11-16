import { Component, FormDialog, parseDate, Select, styled, theme } from '@vanilla-bean/components';
import { stayOpenFor } from '../utils/stayOpenFor';
import { checkboxField, ChoiceChips, keepGroupLayout, numberField, PropertiesField } from '../utils/formFields';

import { getFields, getBuildings, getEquipment } from '../api';
import { toDateOnly } from '../utils/dates';
import { toNum } from '../utils/format.js';
import { entityIcon } from '../utils/icons';

const { colors, space } = theme;

const Hint = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.xs} 0 ${space.xs};
		font-size: 11px;
		color: ${colors.muted};
	`,
);

// The asset a lease or loan was opened from, named in place of a picker
const PresetEntity = styled(
	Component,
	({ colors, space }) => `
		padding: ${space.sm} 0 ${space.xs};
		font-size: 13px;
		color: ${colors.muted};
	`,
);

export const RATE_TYPES = [
	{ value: 'cash_per_acre', label: 'Cash Rent ($/acre)' },
	{ value: 'crop_share', label: 'Crop Share (%)' },
	{ value: 'monthly', label: 'Flat Monthly ($)' },
	{ value: 'annual', label: 'Flat Annual ($)' },
	{ value: 'hourly', label: 'Hourly Rate ($/hr)' },
	{ value: 'per_use', label: 'Per Use / Per Day ($)' },
];

const format = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const calcMonthlyPayment = (principal, annualRatePct, termYears) => {
	const P = Number(principal);
	const r = Number(annualRatePct) / 100 / 12;
	const n = Number(termYears) * 12;

	if (!P || !n) return 0;
	if (!r) return P / n;

	return (P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
};

const rateLabel = lease => {
	if (lease._isLoan || lease.role === 'loan') {
		const mp = Number(lease.monthlyPayment);
		const rate = Number(lease.interestRate);
		const balance = Number(lease.currentBalance || lease.loanAmount);

		const parts = [];

		if (mp) parts.push(`$${format(mp)}/mo`);
		if (rate) parts.push(`${rate}% APR`);
		if (balance) parts.push(`$${format(balance)} balance`);

		return parts.join(' · ') || 'Loan';
	}

	const amt = Number(lease.rateAmount);
	const pct = Number(lease.cropSharePercent);

	switch (lease.type) {
		case 'cash_per_acre':
		case 'cash':
			return amt ? `$${amt}/ac` : 'Cash Rent';
		case 'crop_share':
			return pct ? `${pct}% share` : 'Crop Share';
		case 'monthly':
			return amt ? `$${amt}/mo` : 'Monthly';
		case 'annual':
			return amt ? `$${amt}/yr` : 'Annual';
		case 'hourly':
			return amt ? `$${amt}/hr` : 'Hourly';
		case 'per_use':
			return amt ? `$${amt}/use` : 'Per Use';
		default:
			return '';
	}
};

export { rateLabel };

const withoutCallbacks = ({ onSave: _onSave, onDelete: _onDelete, ...options }) => options;

const ROLES = [
	{ value: 'tenant', label: 'I pay rent', icon: 'arrow-trend-down' },
	{ value: 'lessor', label: 'I receive rent', icon: 'arrow-trend-up' },
	{ value: 'loan', label: 'Loan / Mortgage', icon: 'building-columns' },
];

const ASSET_TYPES = [
	{ value: 'field', label: `${entityIcon('field')} Field` },
	{ value: 'building', label: `${entityIcon('building')} Building` },
	{ value: 'equipment', label: `${entityIcon('equipment')} Equipment` },
];

const TENANT_RATE_TYPES = RATE_TYPES.filter(r => ['cash_per_acre', 'crop_share'].includes(r.value));

const RATE_PLACEHOLDERS = {
	cash_per_acre: '$/acre',
	monthly: '$/month',
	annual: '$/year',
	hourly: '$/hour',
	per_use: '$/use',
	crop_share: '',
};

// The rate type of the role shown: a lessor picks from every kind, a tenant from cash rent and crop share
const rateType = data => (data.role === 'lessor' ? data.lessorRateType : data.tenantRateType);

const isLease = data => data.role !== 'loan';
const isLoan = data => data.role === 'loan';

const asDollars = (value, options) =>
	Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', ...options });

export default class LeaseDialog extends FormDialog {
	constructor(options = {}) {
		const isEdit = !!options.lease?.id;
		const lease = options.lease || {};
		let inferredRole;
		if (lease.lender) {
			inferredRole = 'loan';
		} else if (lease.tenantName) {
			inferredRole = 'lessor';
		} else {
			inferredRole = 'tenant';
		}
		const preRole = options.role || lease.role || inferredRole;
		const headerLabels = { tenant: 'Add Lease', lessor: 'Lease Out Asset', loan: 'Add Loan / Mortgage' };
		// Opened from an asset's panel, the asset is named and the role isn't asked
		const preEntity = options.entity || null;
		const preEntityType = options.entityType || null;
		const pickEntity = !preEntity;

		const field = key => this.form.inputElements[key];
		const data = () => this.form.options.data;
		const grid = (columns, inputs) => ({
			type: 'group',
			style: { display: 'grid', gridTemplateColumns: columns, gap: space.sm },
			inputs,
		});
		const entityPicker = (key, label, condition) => ({
			key,
			label,
			InputComponent: Select,
			options: [],
			condition: values => pickEntity && condition(values),
		});

		super({
			header: isEdit ? 'Edit' : headerLabels[preRole] || 'Add Lease',
			intro: preEntity
				? new PresetEntity({ textContent: `${entityIcon(preEntityType)} ${preEntity.name || 'Selected asset'}` })
				: undefined,
			data: {
				role: preRole,
				assetType: preEntityType || lease.entityType || 'field',
				tenantField: lease.entityId || '',
				lessorField: lease.entityId || '',
				lessorBuilding: lease.entityId || '',
				lessorEquipment: lease.entityId || '',
				tenantName: lease.tenantName || '',
				landlordName: lease.landlordName || '',
				tenantRateType: lease.type || 'cash_per_acre',
				lessorRateType: lease.type || 'monthly',
				rateAmount: lease.rateAmount || '',
				cropSharePercent: lease.cropSharePercent || '',
				leaseStart: lease.startDate || '',
				endDate: lease.endDate || '',
				renewalDate: lease.renewalDate || '',
				paymentTerms: lease.paymentTerms || lease.paymentDates || '',
				leaseProps: lease.properties || {},

				lender: lease.lender || '',
				loanNumber: lease.loanNumber || '',
				loanAmount: lease.loanAmount || '',
				interestRate: lease.interestRate || '',
				termYears: lease.termYears || '',
				monthlyPayment: lease.monthlyPayment || '',
				currentBalance: lease.currentBalance || '',
				escrow: !!lease.escrow,
				loanStart: lease.startDate || '',
				maturityDate: lease.maturityDate || '',
				assetAppraisalValue: lease.assetAppraisalValue || '',
				loanProps: lease.properties || {},
			},
			inputs: [
				{
					key: 'role',
					label: 'Kind',
					InputComponent: ChoiceChips,
					choices: ROLES,
					condition: () => pickEntity,
				},

				// A lease: the asset, the other party and the rate
				entityPicker('tenantField', 'Field', values => values.role === 'tenant'),
				{
					key: 'assetType',
					label: 'Asset Type',
					InputComponent: Select,
					options: ASSET_TYPES,
					condition: values => pickEntity && values.role === 'lessor',
				},
				entityPicker('lessorField', 'Field', values => values.role === 'lessor' && values.assetType === 'field'),
				entityPicker(
					'lessorBuilding',
					'Building',
					values => values.role === 'lessor' && values.assetType === 'building',
				),
				entityPicker(
					'lessorEquipment',
					'Equipment',
					values => values.role === 'lessor' && values.assetType === 'equipment',
				),
				{
					key: 'tenantName',
					label: 'Tenant Name',
					placeholder: 'Full name',
					condition: values => values.role === 'lessor',
				},
				{
					key: 'landlordName',
					label: 'Landlord Name',
					placeholder: 'Full name',
					condition: values => values.role === 'tenant',
				},
				grid('1fr 1fr', [
					{
						key: 'tenantRateType',
						label: 'Rate Type',
						InputComponent: Select,
						options: TENANT_RATE_TYPES,
						condition: values => values.role === 'tenant',
						onChange: () => this._showRatePlaceholder(),
					},
					{
						key: 'lessorRateType',
						label: 'Rate Type',
						InputComponent: Select,
						options: RATE_TYPES,
						condition: values => values.role === 'lessor',
						onChange: () => this._showRatePlaceholder(),
					},
					{
						key: 'rateAmount',
						label: 'Amount',
						placeholder: '0.00',
						...numberField({ step: '0.01' }),
						condition: values => isLease(values) && rateType(values) !== 'crop_share',
					},
				]),
				{
					key: 'cropSharePercent',
					label: 'Crop Share (%)',
					placeholder: 'e.g. 50',
					...numberField(),
					condition: values => isLease(values) && rateType(values) === 'crop_share',
				},
				grid('1fr 1fr 1fr', [
					{ key: 'leaseStart', label: 'Start Date', type: 'date', condition: isLease },
					{ key: 'endDate', label: 'End Date', type: 'date', condition: isLease },
					{ key: 'renewalDate', label: 'Renewal Date', type: 'date', condition: isLease },
				]),
				{
					key: 'paymentTerms',
					label: 'Payment Terms',
					placeholder: 'e.g. March 1 & Sept 1, First of month',
					condition: isLease,
				},
				{ key: 'leaseProps', label: 'Properties', InputComponent: PropertiesField, condition: isLease },

				// A loan: the lender, the terms and the asset's value
				grid('1fr 1fr', [
					{ key: 'lender', label: 'Lender / Bank', placeholder: 'e.g. Farm Credit, USDA FSA', condition: isLoan },
					{ key: 'loanNumber', label: 'Loan / Account #', placeholder: 'Optional', condition: isLoan },
				]),
				grid('1fr 1fr 1fr', [
					{
						key: 'loanAmount',
						label: 'Original Loan Amount ($)',
						placeholder: '0.00',
						...numberField({ step: '1000' }),
						condition: isLoan,
						onInput: () => this._recalculateLoan(),
					},
					{
						key: 'interestRate',
						label: 'Interest Rate (%)',
						placeholder: 'e.g. 4.75',
						...numberField({ step: '0.01' }),
						condition: isLoan,
						onInput: () => this._recalculateLoan(),
					},
					{
						key: 'termYears',
						label: 'Term (years)',
						placeholder: 'e.g. 20',
						...numberField({ step: '1' }),
						condition: isLoan,
						onInput: () => {
							this._recalculateLoan();
							this._fillMaturity();
						},
					},
				]),
				grid('1fr 1fr', [
					{
						key: 'monthlyPayment',
						label: 'Monthly Payment ($)',
						placeholder: 'Auto-calc or enter',
						...numberField({ step: '0.01' }),
						condition: isLoan,
					},
					{
						key: 'currentBalance',
						label: 'Current Balance ($)',
						placeholder: 'Optional',
						...numberField({ step: '1' }),
						condition: isLoan,
						onInput: () => this._showEquity(),
					},
				]),
				checkboxField('escrow', 'Escrow includes taxes and/or insurance', { condition: isLoan }),
				grid('1fr 1fr', [
					{
						key: 'loanStart',
						label: 'Origination Date',
						type: 'date',
						condition: isLoan,
						onChange: () => this._fillMaturity(),
					},
					{ key: 'maturityDate', label: 'Maturity Date', type: 'date', condition: isLoan },
				]),
				// Tracked apart from the loan amount
				{
					key: 'assetAppraisalValue',
					label: 'Asset Appraisal Value ($)',
					placeholder: 'Market / appraised value',
					...numberField({ step: '1' }),
					condition: isLoan,
					onInput: () => this._showEquity(),
				},
				{ key: 'loanProps', label: 'Properties', InputComponent: PropertiesField, condition: isLoan },
			],
			onSave: async values => stayOpenFor(await options.onSave?.(this._collect(values))),
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => stayOpenFor(await options.onDelete()),
					confirmDelete: { header: `Delete this ${preRole === 'loan' ? 'loan' : 'lease'}?` },
				}),
			...withoutCallbacks(options),
		});

		this._lease = lease;
		this._preEntity = preEntity;
		this._preEntityType = preEntityType;
		this._field = field;
		this._data = data;
		this._items = { field: [], building: [], equipment: [] };

		// Live readouts beside the loan's fields, not fields themselves: the payment its terms make, and the equity left
		this._calcHint = new Hint({ appendTo: field('monthlyPayment').elem.parentElement });
		this._equityHint = new Hint({ appendTo: field('assetAppraisalValue').elem.parentElement });

		this._showRatePlaceholder();
		this._recalculateLoan();
		this._showEquity();
		keepGroupLayout(this.form);
		this._loadAssets();
	}

	// The assets a lease can be for, picked from the lists as they arrive
	async _loadAssets() {
		const [fields, buildings, equipment] = await Promise.all([getFields(), getBuildings(), getEquipment()]);

		this._items = {
			field: Object.values(fields?.body || {}),
			building: Object.values(buildings?.body || {}),
			equipment: Object.values(equipment?.body || {}),
		};

		const fill = (key, type, unnamed) => {
			const items = this._items[type];
			const select = this._field(key);

			select.options.options = items.map(i => ({ value: i.id, label: i.name || unnamed }));

			// The lease's own asset when it's listed, else the first
			const value = items.some(i => i.id === this._lease.entityId) ? this._lease.entityId : items[0]?.id || '';

			this._data()[key] = value;
			select.options.value = value;
		};

		fill('tenantField', 'field', 'Unnamed');
		fill('lessorField', 'field', 'Unnamed field');
		fill('lessorBuilding', 'building', 'Unnamed building');
		fill('lessorEquipment', 'equipment', 'Unnamed equipment');
	}

	_showRatePlaceholder() {
		this._field('rateAmount').elem.placeholder = RATE_PLACEHOLDERS[rateType(this._data())] || '0.00';
	}

	// The payment the terms make, filled in while the payment is empty
	_recalculateLoan() {
		const P = Number(this._field('loanAmount').options.value);
		const r = Number(this._field('interestRate').options.value);
		const t = Number(this._field('termYears').options.value);

		if (P && t) {
			const mp = calcMonthlyPayment(P, r, t);

			this._calcHint.elem.textContent = `Calculated payment: ${asDollars(mp)}/mo`;

			if (this._field('monthlyPayment').options.value === '') this._data().monthlyPayment = mp.toFixed(2);
		} else {
			this._calcHint.elem.textContent = '';
		}
	}

	// The maturity, from the origination and the term, while it's empty
	_fillMaturity() {
		const start = this._field('loanStart').options.value;
		const term = this._field('termYears').options.value;

		if (start && term !== '' && !this._field('maturityDate').options.value) {
			const d = parseDate(start);

			d.setFullYear(d.getFullYear() + Number(term));
			this._data().maturityDate = toDateOnly(d);
		}
	}

	_showEquity() {
		const av = Number(this._field('assetAppraisalValue').options.value);
		const balance =
			Number(this._field('currentBalance').options.value) || Number(this._field('loanAmount').options.value) || 0;

		if (av && balance) {
			const equity = av - balance;
			const ltv = ((balance / av) * 100).toFixed(1);

			this._equityHint.elem.style.color = colors.light(equity >= 0 ? colors.success : colors.danger);
			this._equityHint.elem.textContent = `Equity: ${asDollars(equity, { maximumFractionDigits: 0 })} · LTV ${ltv}%`;
		} else {
			this._equityHint.elem.textContent = '';
		}
	}

	// The asset the lease is for: the one it was opened from, else the one picked
	_entity(values) {
		if (this._preEntity) {
			return {
				entityType: this._preEntityType,
				entityId: this._preEntity.id,
				entityName: this._preEntity.name || '',
			};
		}

		const type = values.role === 'lessor' ? values.assetType : 'field';
		const key = values.role === 'lessor' ? `lessor${type[0].toUpperCase()}${type.slice(1)}` : 'tenantField';
		const id = values[key];

		return { entityType: type, entityId: id, entityName: this._items[type].find(i => i.id === id)?.name || '' };
	}

	_collect(values) {
		if (values.role === 'loan') {
			return {
				role: 'loan',
				// A loan has no picker: the asset it was opened from, else the one it's already for
				entityType: this._preEntityType || this._lease.entityType || '',
				entityId: this._preEntity?.id || this._lease.entityId || '',
				entityName: this._preEntity?.name || this._lease.entityName || '',
				lender: values.lender,
				loanNumber: values.loanNumber,
				loanAmount: toNum(values.loanAmount),
				interestRate: toNum(values.interestRate),
				termYears: toNum(values.termYears),
				monthlyPayment: toNum(values.monthlyPayment),
				currentBalance: toNum(values.currentBalance),
				escrow: values.escrow,
				assetAppraisalValue: toNum(values.assetAppraisalValue),
				startDate: values.loanStart,
				maturityDate: values.maturityDate,
				properties: values.loanProps,
			};
		}

		const nameKey = values.role === 'lessor' ? 'tenantName' : 'landlordName';

		return {
			role: values.role,
			...this._entity(values),
			[nameKey]: values[nameKey],
			type: rateType(values),
			rateAmount: toNum(values.rateAmount),
			cropSharePercent: toNum(values.cropSharePercent),
			startDate: values.leaseStart,
			endDate: values.endDate,
			renewalDate: values.renewalDate,
			paymentTerms: values.paymentTerms,
			properties: values.leaseProps,
		};
	}
}
