import {
	Button,
	Component,
	Elem,
	EmptyState,
	formatDate,
	Icon,
	parseDate,
	SectionLabel,
	styled,
	theme,
	Toolbar,
} from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import {
	getLeases,
	getLoans,
	getFields,
	createLease,
	updateLease,
	deleteLease,
	createLoan,
	updateLoan,
	deleteLoan,
} from '../api';
import context from '../context';
import { PageView, RecordCard } from '../Layout';
import { entityIcon } from '../utils/icons';

import LeaseDialog, { rateLabel } from './LeaseDialog';

const { colors, space } = theme;

const TitleRow = styled(
	Component,
	({ space }) => `
		display: flex;
		justify-content: space-between;
		gap: ${space.sm};
		margin-bottom: ${space.xs};
	`,
);

const EntityName = styled(
	Component,
	({ colors }) => `
		min-width: 0;
		overflow: hidden;
		font-size: 12px;
		color: ${colors.muted};
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	{ tag: 'span' },
);

const daysUntil = dateStr => {
	if (!dateStr) return null;

	return Math.ceil((parseDate(dateStr) - new Date()) / 86_400_000);
};

export default class Leases extends AsyncView {
	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Leases', gap: 8 });

		const addButtons = new Component({ appendTo: this.toolbar, style: { display: 'flex', gap: space.sm } });

		new Button({
			appendTo: addButtons,
			icon: 'arrow-trend-down',
			textContent: 'I pay',
			title: 'Add lease I pay',
			onPointerPress: () =>
				new LeaseDialog({
					role: 'tenant',
					onSave: async data => {
						return this._save(data);
					},
				}),
		});

		new Button({
			appendTo: addButtons,
			append: new Icon({ icon: 'plus' }),
			title: 'Add lease (default)',
			onPointerPress: () =>
				new LeaseDialog({
					onSave: async data => {
						return this._save(data);
					},
				}),
		});

		new Button({
			appendTo: addButtons,
			icon: 'arrow-trend-up',
			textContent: 'I receive',
			title: 'Add income lease',
			onPointerPress: () =>
				new LeaseDialog({
					role: 'lessor',
					onSave: async data => {
						return this._save(data);
					},
				}),
		});

		new Button({
			appendTo: addButtons,
			icon: 'building-columns',
			textContent: 'Loan',
			title: 'Add loan / mortgage',
			onPointerPress: () =>
				new LeaseDialog({
					role: 'loan',
					onSave: async data => {
						return this._save(data);
					},
				}),
		});

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { leases: getLeases, loans: getLoans, fields: getFields };
	}

	_onData() {
		this._renderList();
	}

	// Hands back the request's result, so the dialog stays open when it failed
	async _save(data) {
		const isLoan = data.role === 'loan';
		const result = isLoan ? await createLoan({ body: data }) : await createLease({ body: data });
		const collection = isLoan ? this.loans : this.leases;

		if (result?.status === 'success' && collection?.body) {
			collection.body[result.body.id] = result.body;
			context.hasLeases = true;
			this._renderList();
		}

		return result;
	}

	_renderList() {
		this.content.empty();

		const allLeases = Object.values(this.leases?.body || {});
		const allLoans = Object.values(this.loans?.body || {});

		context.hasLeases = allLeases.length > 0 || allLoans.length > 0;

		if (!allLeases.length && !allLoans.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'file-contract',
				title: 'No leases or loans recorded',
				message: 'Track land rent you pay, income from leasing out assets, and farm loans',
			});
			return;
		}

		const outgoing = allLeases
			.filter(l => !l.role || l.role === 'tenant')
			.sort((a, b) => (a.landlordName || '').localeCompare(b.landlordName || ''));
		const incoming = allLeases
			.filter(l => l.role === 'lessor')
			.sort((a, b) => (a.entityName || '').localeCompare(b.entityName || ''));
		const loanList = allLoans.sort((a, b) => (a.lender || '').localeCompare(b.lender || ''));

		if (outgoing.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Leases I Pay' });
			for (const lease of outgoing) this._renderCard(lease, 'tenant', false);
		}

		if (incoming.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Income Leases' });
			for (const lease of incoming) this._renderCard(lease, 'lessor', false);
		}

		if (loanList.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Loans & Mortgages' });
			for (const loan of loanList) this._renderCard(loan, 'loan', true);
		}
	}

	_renderCard(lease, role, isFromLoansCollection) {
		const isLoan = role === 'loan';
		const isLessor = role === 'lessor';
		const field = this.fields?.body?.[lease.entityId];
		const days = daysUntil(lease.renewalDate);
		let urgentColor;
		if (days !== null && days <= 30) {
			urgentColor = colors.light(colors.danger);
		} else if (days !== null && days <= 90) {
			urgentColor = colors.light(colors.orange);
		} else {
			urgentColor = null;
		}

		const card = new RecordCard({
			appendTo: this.content,
			onPointerPress: () =>
				new LeaseDialog({
					lease: isLoan ? { ...lease, role: 'loan' } : lease,
					onSave: async data => {
						const update = isFromLoansCollection ? updateLoan : updateLease;
						const collection = isFromLoansCollection ? this.loans : this.leases;
						const result = await update(lease.id, { body: { ...data, _v: lease._v } });

						if (result?.status === 'success' && result.body && collection?.body) {
							collection.body[lease.id] = result.body;
							this._renderList();
						}

						return result;
					},
					onDelete: async () => {
						const collection = isFromLoansCollection ? this.loans : this.leases;
						const result = isFromLoansCollection ? await deleteLoan(lease.id) : await deleteLease(lease.id);

						if (result?.status !== 'success') return result;

						if (collection?.body) delete collection.body[lease.id];
						context.hasLeases =
							Object.keys(this.leases?.body || {}).length > 0 || Object.keys(this.loans?.body || {}).length > 0;
						this._renderList();

						return result;
					},
				}),
		});

		const titleRow = new TitleRow({ appendTo: card });
		let primaryName;
		if (isLoan) {
			primaryName = lease.lender || 'Unknown Lender';
		} else if (isLessor) {
			primaryName = lease.tenantName || 'Unknown Tenant';
		} else {
			primaryName = lease.landlordName || 'Unknown Landlord';
		}

		new Elem({ tag: 'div', appendTo: titleRow, addClass: 'card-title', textContent: primaryName });

		const entityName = lease.entityName || field?.name;

		if (entityName) {
			new EntityName({ appendTo: titleRow, textContent: `${entityIcon(lease.entityType || 'field')} ${entityName}` });
		}

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });
		const rate = rateLabel(lease);

		if (rate) {
			let rateColor;
			if (isLessor) {
				rateColor = colors.light(colors.success);
			} else if (isLoan) {
				rateColor = colors.light(colors.orange);
			} else {
				rateColor = colors.muted;
			}
			new Elem({
				tag: 'span',
				appendTo: meta,
				style: { color: rateColor },
				textContent: rate,
			});
		}

		if (isLoan) {
			if (lease.loanNumber)
				new Elem({
					tag: 'span',
					appendTo: meta,
					style: { color: colors.gray },
					textContent: `#${lease.loanNumber}`,
				});
			if (lease.maturityDate)
				new Elem({ tag: 'span', appendTo: meta, textContent: `Matures ${formatDate(lease.maturityDate)}` });
			if (lease.escrow) new Elem({ tag: 'span', appendTo: meta, style: { color: colors.gray }, textContent: 'Escrow' });
		} else {
			if (lease.endDate) new Elem({ tag: 'span', appendTo: meta, textContent: `Ends ${formatDate(lease.endDate)}` });
			if (lease.paymentTerms || lease.paymentDates)
				new Elem({
					tag: 'span',
					appendTo: meta,
					style: { color: colors.gray },
					textContent: lease.paymentTerms || lease.paymentDates,
				});

			if (lease.renewalDate && urgentColor) {
				new Elem({
					tag: 'div',
					appendTo: card,
					style: { fontSize: '12px', color: urgentColor, marginTop: space.xs },
					textContent: days <= 0 ? 'Renewal past due!' : `Renewal in ${days} days`,
				});
			}
		}
	}
}
