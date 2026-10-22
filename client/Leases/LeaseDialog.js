import { Button, Component, Elem, FormDialog, Input, parseDate, Select, styled, theme } from '@vanilla-bean/components';
import { keepOpenIfFailed } from '../utils/keepOpenIfFailed';
import { makePropertiesEditor } from '../utils/PropertiesEditor';
import { FormLabel } from '../Layout';

import { getFields, getBuildings, getEquipment } from '../api';
import { toDateOnly } from '../utils/dates';
import { entityIcon } from '../utils/icons';

const { colors } = theme;

const Hint = styled(
	Component,
	({ colors }) => `
		padding: 2px 0 4px;
		font-size: 11px;
		color: ${colors.gray};
	`,
);

// The asset a lease or loan was opened from, named in place of a picker
const PresetEntity = styled(
	Component,
	({ colors }) => `
		padding: 6px 0 2px;
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

		// The body is built by hand below, so the form holds no inputs and saving collects from the body
		super({
			size: 'large',
			header: isEdit ? 'Edit' : headerLabels[preRole] || 'Add Lease',
			inputs: [],
			onSave: async () => keepOpenIfFailed(await options.onSave?.(this._collect())),
			...(isEdit &&
				options.onDelete && {
					onDelete: async () => keepOpenIfFailed(await options.onDelete(), 'Delete'),
					confirmDelete: { header: `Delete this ${preRole === 'loan' ? 'loan' : 'lease'}?` },
				}),
			...withoutCallbacks(options),
		});

		this._lease = lease;
		this._preRole = preRole;
		this._preEntity = options.entity || null;
		this._preEntityType = options.entityType || null;
		this._collect = () => ({});

		this._buildForm();
	}

	async _buildForm() {
		const lease = this._lease;

		// Role toggle — hidden if pre-set from a specific entity panel
		const showRoleToggle = !this._preEntity;
		let role = this._preRole;

		const rebuildBody = async () => {
			formArea.empty();
			await this._buildBody(formArea, lease, role, this._preEntity, this._preEntityType);
		};

		if (showRoleToggle) {
			const toggleRow = new Component({
				appendTo: this.body,
				style: { display: 'flex', gap: '8px', marginBottom: '4px' },
			});

			const toggleButtons = [];

			const makeToggle = (icon, label, value) => {
				const btn = new Button({
					appendTo: toggleRow,
					variant: 'chip',
					icon,
					textContent: label,
					style: { flex: '1' },
					onPointerPress: async () => {
						role = value;
						for (const [b, v] of toggleButtons) b.toggleClass('active', role === v);

						await rebuildBody();
					},
				});

				btn.toggleClass('active', role === value);
				toggleButtons.push([btn, value]);

				return btn;
			};

			makeToggle('arrow-trend-down', 'I pay rent', 'tenant');
			makeToggle('arrow-trend-up', 'I receive rent', 'lessor');
			makeToggle('building-columns', 'Loan / Mortgage', 'loan');
		}

		const formArea = new Component({ appendTo: this.body });

		await this._buildBody(formArea, lease, role, this._preEntity, this._preEntityType);
	}

	async _buildBody(container, lease, role, preEntity, preEntityType) {
		if (role === 'loan') {
			await this._buildLoanBody(container, lease, preEntity, preEntityType);
			return;
		}

		const isLessor = role === 'lessor';

		// Entity section
		if (preEntity) {
			// Pre-set — just show a label
			new PresetEntity({
				appendTo: container,
				textContent: `${entityIcon(preEntityType)} ${preEntity.name || 'Selected asset'}`,
			});

			this._entityId = preEntity.id;
			this._entityType = preEntityType;
			this._entityName = preEntity.name || '';
		} else {
			// Entity type picker (lessor only — tenant is always field)
			let entityType = preEntityType || lease.entityType || 'field';

			if (isLessor) {
				new FormLabel({ appendTo: container, textContent: 'Asset Type' });
				const typeSelect = new Select({ appendTo: container });
				for (const { value: v, label: l } of [
					{ value: 'field', label: `${entityIcon('field')} Field` },
					{ value: 'building', label: `${entityIcon('building')} Building` },
					{ value: 'equipment', label: `${entityIcon('equipment')} Equipment` },
				]) {
					const o = document.createElement('option');
					o.value = v;
					o.textContent = l;
					typeSelect.elem.append(o);
				}
				typeSelect.elem.value = entityType;

				const entityPickerWrap = new Component({ appendTo: container });

				const buildEntityPicker = async type => {
					entityPickerWrap.empty();
					let entityTypeLabel;
					if (type === 'field') {
						entityTypeLabel = 'Field';
					} else if (type === 'building') {
						entityTypeLabel = 'Building';
					} else {
						entityTypeLabel = 'Equipment';
					}
					new FormLabel({
						appendTo: entityPickerWrap,
						textContent: entityTypeLabel,
					});

					let items = [];

					if (type === 'field') {
						const d = await getFields();
						items = Object.values(d?.body || {});
					} else if (type === 'building') {
						const d = await getBuildings();
						items = Object.values(d?.body || {});
					} else {
						const d = await getEquipment();
						items = Object.values(d?.body || {});
					}

					const select = new Select({ appendTo: entityPickerWrap });
					for (const { value: v, label: l } of items.map(i => ({ value: i.id, label: i.name || `Unnamed ${type}` }))) {
						const o = document.createElement('option');
						o.value = v;
						o.textContent = l;
						select.elem.append(o);
					}
					select.elem.value = lease.entityId || items[0]?.id || '';
					this._entityId = select.elem.value;
					this._entityType = type;
					this._entityName = items.find(i => i.id === select.elem.value)?.name || '';
					select.elem.addEventListener('change', () => {
						this._entityId = select.elem.value;
						this._entityName = items.find(i => i.id === select.elem.value)?.name || '';
					});
				};

				await buildEntityPicker(entityType);

				typeSelect.elem.addEventListener('change', async () => {
					entityType = typeSelect.elem.value;
					await buildEntityPicker(entityType);
				});
			} else {
				// Tenant: field only
				new FormLabel({ appendTo: container, textContent: 'Field' });
				const fieldsData = await getFields();
				const fields = Object.values(fieldsData?.body || {});
				const fieldSelect = new Select({ appendTo: container });
				for (const { value: v, label: l } of fields.map(f => ({ value: f.id, label: f.name || 'Unnamed' }))) {
					const o = document.createElement('option');
					o.value = v;
					o.textContent = l;
					fieldSelect.elem.append(o);
				}
				fieldSelect.elem.value = lease.entityId || fields[0]?.id || '';
				this._entityId = fieldSelect.elem.value;
				this._entityType = 'field';
				this._entityName = fields.find(f => f.id === fieldSelect.elem.value)?.name || '';
				fieldSelect.elem.addEventListener('change', () => {
					this._entityId = fieldSelect.elem.value;
					this._entityName = fields.find(f => f.id === fieldSelect.elem.value)?.name || '';
				});
			}
		}

		// Counterparty — each column is a stacked label+input pair
		const nameKey = isLessor ? 'tenantName' : 'landlordName';

		const makeCol = (parent, label, inputOpts) => {
			const col = new Component({ appendTo: parent });

			new FormLabel({ appendTo: col, textContent: label });
			const el = new Input({ appendTo: col, ...inputOpts });
			if (inputOpts?.value !== undefined) el.elem.value = inputOpts.value;

			return el;
		};

		new FormLabel({ appendTo: container, textContent: isLessor ? 'Tenant Name' : 'Landlord Name' });
		const nameEl = new Input({ appendTo: container, placeholder: 'Full name' });
		nameEl.elem.value = lease[nameKey] || '';

		// Rate
		const rateTypeRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' },
		});

		const rateTypeCol = new Component({ appendTo: rateTypeRow });

		new FormLabel({ appendTo: rateTypeCol, textContent: 'Rate Type' });

		const rateOpts = isLessor ? RATE_TYPES : RATE_TYPES.filter(r => ['cash_per_acre', 'crop_share'].includes(r.value));
		const typeSelect = new Select({ appendTo: rateTypeCol });
		for (const { value: v, label: l } of rateOpts) {
			const o = document.createElement('option');
			o.value = v;
			o.textContent = l;
			typeSelect.elem.append(o);
		}
		typeSelect.elem.value = lease.type || (isLessor ? 'monthly' : 'cash_per_acre');

		const rateAmtCol = new Component({ appendTo: rateTypeRow });

		new FormLabel({ appendTo: rateAmtCol, textContent: 'Amount' });
		const rateEl = new Input({ appendTo: rateAmtCol, type: 'number', step: '0.01', placeholder: '0.00' });
		rateEl.elem.value = lease.rateAmount || '';

		// Crop share — shown only when type is crop_share
		const shareWrap = new Component({ appendTo: container });

		new FormLabel({ appendTo: shareWrap, textContent: 'Crop Share (%)' });
		const shareEl = new Input({ appendTo: shareWrap, type: 'number', placeholder: 'e.g. 50' });
		shareEl.elem.value = lease.cropSharePercent || '';

		const updateRateUI = () => {
			const isCropShare = typeSelect.elem.value === 'crop_share';

			shareWrap.elem.style.display = isCropShare ? '' : 'none';
			rateAmtCol.elem.style.display = isCropShare ? 'none' : '';
			rateEl.elem.placeholder =
				{
					cash_per_acre: '$/acre',
					monthly: '$/month',
					annual: '$/year',
					hourly: '$/hour',
					per_use: '$/use',
					crop_share: '',
				}[typeSelect.elem.value] || '0.00';
		};

		typeSelect.elem.addEventListener('change', updateRateUI);
		updateRateUI();

		// Dates — each column stacked
		const dateRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' },
		});
		const startEl = makeCol(dateRow, 'Start Date', { type: 'date', value: lease.startDate || '' });
		const endEl = makeCol(dateRow, 'End Date', { type: 'date', value: lease.endDate || '' });
		const renewEl = makeCol(dateRow, 'Renewal Date', { type: 'date', value: lease.renewalDate || '' });

		new FormLabel({ appendTo: container, textContent: 'Payment Terms' });
		const payEl = new Input({ appendTo: container, placeholder: 'e.g. March 1 & Sept 1, First of month' });
		payEl.elem.value = lease.paymentTerms || lease.paymentDates || '';

		const { collect: collectProps } = makePropertiesEditor(container, lease.properties || {});

		this._collect = () => ({
			role,
			entityType: this._entityType,
			entityId: this._entityId,
			entityName: this._entityName,
			[nameKey]: nameEl.elem.value,
			type: typeSelect.elem.value,
			rateAmount: rateEl.elem.value ? Number(rateEl.elem.value) : null,
			cropSharePercent: shareEl.elem.value ? Number(shareEl.elem.value) : null,
			startDate: startEl.elem.value,
			endDate: endEl.elem.value,
			renewalDate: renewEl.elem.value,
			paymentTerms: payEl.elem.value,
			properties: collectProps(),
		});
	}

	async _buildLoanBody(container, lease, preEntity, preEntityType) {
		// Entity label
		if (preEntity) {
			new PresetEntity({
				appendTo: container,
				textContent: `${entityIcon(preEntityType)} ${preEntity.name || 'Selected asset'}`,
			});

			this._entityId = preEntity.id;
			this._entityType = preEntityType;
			this._entityName = preEntity.name || '';
		}

		const makeCol = (parent, label, inputOpts) => {
			const col = new Component({ appendTo: parent });

			new FormLabel({ appendTo: col, textContent: label });
			const el = new Input({ appendTo: col, ...inputOpts });
			if (inputOpts?.value !== undefined) el.elem.value = inputOpts.value;

			return el;
		};

		// Lender
		const lenderRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' },
		});
		const lenderEl = makeCol(lenderRow, 'Lender / Bank', {
			placeholder: 'e.g. Farm Credit, USDA FSA',
			value: lease.lender || '',
		});
		const loanNumEl = makeCol(lenderRow, 'Loan / Account #', {
			placeholder: 'Optional',
			value: lease.loanNumber || '',
		});

		// Loan terms
		const termsRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' },
		});
		const principalEl = makeCol(termsRow, 'Original Loan Amount ($)', {
			type: 'number',
			step: '1000',
			placeholder: '0.00',
			value: lease.loanAmount || '',
		});
		const rateEl = makeCol(termsRow, 'Interest Rate (%)', {
			type: 'number',
			step: '0.01',
			placeholder: 'e.g. 4.75',
			value: lease.interestRate || '',
		});
		const termEl = makeCol(termsRow, 'Term (years)', {
			type: 'number',
			step: '1',
			placeholder: 'e.g. 20',
			value: lease.termYears || '',
		});

		// Monthly payment — auto-calc
		const paymentRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
		});
		const paymentEl = makeCol(paymentRow, 'Monthly Payment ($)', {
			type: 'number',
			step: '0.01',
			placeholder: 'Auto-calc or enter',
			value: lease.monthlyPayment || '',
		});
		const balanceEl = makeCol(paymentRow, 'Current Balance ($)', {
			type: 'number',
			step: '1',
			placeholder: 'Optional',
			value: lease.currentBalance || '',
		});

		// Auto-calc payment hint
		const calcHint = new Hint({ appendTo: container });

		const recalculatePayment = () => {
			const P = Number(principalEl.elem.value);
			const r = Number(rateEl.elem.value);
			const t = Number(termEl.elem.value);

			if (P && t) {
				const mp = calcMonthlyPayment(P, r, t);

				calcHint.elem.textContent = `Calculated payment: ${Number(mp).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/mo`;

				if (!paymentEl.elem.value) paymentEl.elem.value = mp.toFixed(2);
			} else {
				calcHint.elem.textContent = '';
			}
		};

		principalEl.elem.addEventListener('input', recalculatePayment);
		rateEl.elem.addEventListener('input', recalculatePayment);
		termEl.elem.addEventListener('input', recalculatePayment);

		// Escrow
		const escrowRow = new Component({
			appendTo: container,
			style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' },
		});
		const escrowCb = new Input({
			appendTo: escrowRow,
			type: 'checkbox',
			id: 'loan-escrow-cb',
		});

		escrowCb.elem.checked = !!lease.escrow;

		new Elem({
			tag: 'label',
			appendTo: escrowRow,
			textContent: 'Escrow includes taxes and/or insurance',
			style: { fontSize: '13px', color: colors.muted, cursor: 'pointer' },
			attributes: { for: 'loan-escrow-cb' },
		});

		// Dates
		const dateRow = new Component({
			appendTo: container,
			style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' },
		});
		const startEl = makeCol(dateRow, 'Origination Date', { type: 'date', value: lease.startDate || '' });
		const maturityEl = makeCol(dateRow, 'Maturity Date', { type: 'date', value: lease.maturityDate || '' });

		// Auto-fill maturity from start + term
		const recalculateMaturity = () => {
			if (startEl.elem.value && termEl.elem.value && !maturityEl.elem.value) {
				const d = parseDate(startEl.elem.value);

				d.setFullYear(d.getFullYear() + Number(termEl.elem.value));
				maturityEl.elem.value = toDateOnly(d);
			}
		};

		startEl.elem.addEventListener('change', recalculateMaturity);
		termEl.elem.addEventListener('input', recalculateMaturity);

		// Asset appraisal — tracked separately from loan amount
		new FormLabel({ appendTo: container, textContent: 'Asset Appraisal Value ($)' });
		const appraisalEl = new Input({
			appendTo: container,
			type: 'number',
			step: '1',
			placeholder: 'Market / appraised value',
		});
		appraisalEl.elem.value = lease.assetAppraisalValue || '';

		// Live equity preview
		const equityHint = new Hint({ appendTo: container });

		const updateEquity = () => {
			const av = Number(appraisalEl.elem.value);
			const balance = Number(balanceEl.elem.value) || Number(principalEl.elem.value) || 0;

			if (av && balance) {
				const equity = av - balance;
				const ltv = ((balance / av) * 100).toFixed(1);
				const color = equity >= 0 ? colors.success : colors.danger;

				equityHint.elem.style.color = `${colors.light(color)}`;
				equityHint.elem.textContent = `Equity: ${Number(equity).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} · LTV ${ltv}%`;
			} else {
				equityHint.elem.textContent = '';
			}
		};

		appraisalEl.elem.addEventListener('input', updateEquity);
		balanceEl.elem.addEventListener('input', updateEquity);

		recalculatePayment();
		updateEquity();

		const { collect: collectProps } = makePropertiesEditor(container, lease.properties || {});

		this._collect = () => ({
			role: 'loan',
			// Prefer the closure-captured preEntity/preEntityType — they can't be mutated by other code paths
			entityType: preEntityType || this._entityType || '',
			entityId: preEntity?.id || this._entityId || '',
			entityName: preEntity?.name || this._entityName || '',
			lender: lenderEl.elem.value,
			loanNumber: loanNumEl.elem.value,
			loanAmount: principalEl.elem.value ? Number(principalEl.elem.value) : null,
			interestRate: rateEl.elem.value ? Number(rateEl.elem.value) : null,
			termYears: termEl.elem.value ? Number(termEl.elem.value) : null,
			monthlyPayment: paymentEl.elem.value ? Number(paymentEl.elem.value) : null,
			currentBalance: balanceEl.elem.value ? Number(balanceEl.elem.value) : null,
			escrow: escrowCb.elem.checked,
			assetAppraisalValue: appraisalEl.elem.value ? Number(appraisalEl.elem.value) : null,
			startDate: startEl.elem.value,
			maturityDate: maturityEl.elem.value,
			properties: collectProps(),
		});
	}
}
