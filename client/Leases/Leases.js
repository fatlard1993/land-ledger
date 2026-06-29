import { Elem, Button, Icon, Component } from '@vanilla-bean/components';

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
import { PageView, PageToolbar, PageTitle, Card, AppEmptyState, SectionHeader } from '../Layout';

import LeaseDialog, { rateLabel } from './LeaseDialog';

const formatDate = dateStr => {
	if (!dateStr) return null;
	const d = new Date(dateStr);

	return isNaN(d) ? dateStr : d.toLocaleDateString();
};

const daysUntil = dateStr => {
	if (!dateStr) return null;

	return Math.ceil((new Date(dateStr) - new Date()) / 86_400_000);
};

const entityIcon = type => ({ field: '📋', building: '🏚️', equipment: '🚜' })[type] || '📋';

export default class Leases extends AsyncView {
	_buildView() {
		this.toolbar = new PageToolbar({ appendTo: this });
		new PageTitle({ appendTo: this.toolbar, textContent: 'Leases' });

		const addButtons = new Component({ appendTo: this.toolbar, style: { display: 'flex', gap: '6px' } });

		new Button({
			appendTo: addButtons,
			textContent: '📤 I pay',
			title: 'Add lease I pay',
			style: { fontSize: '12px', padding: '5px 10px' },
			onPointerPress: () =>
				new LeaseDialog({
					role: 'tenant',
					onSave: async data => {
						await this._save(data);
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
						await this._save(data);
					},
				}),
		});

		new Button({
			appendTo: addButtons,
			textContent: '📥 I receive',
			title: 'Add income lease',
			style: { fontSize: '12px', padding: '5px 10px' },
			onPointerPress: () =>
				new LeaseDialog({
					role: 'lessor',
					onSave: async data => {
						await this._save(data);
					},
				}),
		});

		new Button({
			appendTo: addButtons,
			textContent: '🏦 Loan',
			title: 'Add loan / mortgage',
			style: { fontSize: '12px', padding: '5px 10px' },
			onPointerPress: () =>
				new LeaseDialog({
					role: 'loan',
					onSave: async data => {
						await this._save(data);
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

	async _save(data) {
		if (data.role === 'loan') {
			const result = await createLoan({ body: data });
			if (result?.body && this.loans?.body) {
				this.loans.body[result.body.id] = result.body;
				context.hasLeases = true;
				this._renderList();
			}
		} else {
			const result = await createLease({ body: data });
			if (result?.body && this.leases?.body) {
				this.leases.body[result.body.id] = result.body;
				context.hasLeases = true;
				this._renderList();
			}
		}
	}

	_renderList() {
		this.content.empty();

		const allLeases = Object.values(this.leases?.body || {});
		const allLoans = Object.values(this.loans?.body || {});

		context.hasLeases = allLeases.length > 0 || allLoans.length > 0;

		if (!allLeases.length && !allLoans.length) {
			new AppEmptyState({
				appendTo: this.content,
				icon: '📝',
				title: 'No leases or loans recorded',
				subtitle: 'Track land rent you pay, income from leasing out assets, and farm loans',
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
			new SectionHeader({ appendTo: this.content, textContent: '📤 Leases I Pay' });
			for (const lease of outgoing) this._renderCard(lease, 'tenant', false);
		}

		if (incoming.length) {
			new SectionHeader({ appendTo: this.content, textContent: '📥 Income Leases' });
			for (const lease of incoming) this._renderCard(lease, 'lessor', false);
		}

		if (loanList.length) {
			new SectionHeader({ appendTo: this.content, textContent: '🏦 Loans & Mortgages' });
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
			urgentColor = '#e05252';
		} else if (days !== null && days <= 90) {
			urgentColor = '#e8832a';
		} else {
			urgentColor = null;
		}

		const card = new Card({
			appendTo: this.content,
			onPointerPress: () =>
				new LeaseDialog({
					lease: isLoan ? { ...lease, role: 'loan' } : lease,
					onSave: async data => {
						if (isFromLoansCollection) {
							const result = await updateLoan(lease.id, { body: { ...data, _v: lease._v } });
							if (result?.body && this.loans?.body) {
								this.loans.body[lease.id] = result.body;
								this._renderList();
							}
						} else {
							const result = await updateLease(lease.id, { body: { ...data, _v: lease._v } });
							if (result?.body && this.leases?.body) {
								this.leases.body[lease.id] = result.body;
								this._renderList();
							}
						}
					},
					onDelete: async () => {
						if (isFromLoansCollection) {
							await deleteLoan(lease.id);
							if (this.loans?.body) delete this.loans.body[lease.id];
						} else {
							await deleteLease(lease.id);
							if (this.leases?.body) delete this.leases.body[lease.id];
						}
						context.hasLeases =
							Object.keys(this.leases?.body || {}).length > 0 || Object.keys(this.loans?.body || {}).length > 0;
						this._renderList();
					},
				}),
		});

		const titleRow = new Elem({
			tag: 'div',
			appendTo: card,
			style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
		});
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
			new Elem({
				tag: 'span',
				appendTo: titleRow,
				style: { fontSize: '12px', color: 'var(--color-medium)' },
				textContent: `${entityIcon(lease.entityType || 'field')} ${entityName}`,
			});
		}

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });
		const rate = rateLabel(lease);

		if (rate) {
			let rateColor;
			if (isLessor) {
				rateColor = '#4caf50';
			} else if (isLoan) {
				rateColor = '#e8832a';
			} else {
				rateColor = 'var(--color-medium)';
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
					style: { color: 'rgba(255,255,255,0.3)' },
					textContent: `#${lease.loanNumber}`,
				});
			if (lease.maturityDate)
				new Elem({ tag: 'span', appendTo: meta, textContent: `Matures ${formatDate(lease.maturityDate)}` });
			if (lease.escrow)
				new Elem({ tag: 'span', appendTo: meta, style: { color: 'rgba(255,255,255,0.35)' }, textContent: 'Escrow' });
		} else {
			if (lease.endDate) new Elem({ tag: 'span', appendTo: meta, textContent: `Ends ${formatDate(lease.endDate)}` });
			if (lease.paymentTerms || lease.paymentDates)
				new Elem({
					tag: 'span',
					appendTo: meta,
					style: { color: 'rgba(255,255,255,0.3)' },
					textContent: lease.paymentTerms || lease.paymentDates,
				});

			if (lease.renewalDate && urgentColor) {
				new Elem({
					tag: 'div',
					appendTo: card,
					style: { fontSize: '12px', color: urgentColor, marginTop: '4px' },
					textContent: days <= 0 ? 'Renewal past due!' : `Renewal in ${days} days`,
				});
			}
		}
	}
}
