import { Component, Elem } from '@vanilla-bean/components';

import { SectionHeader } from '../Layout';
import LeaseDialog, { rateLabel } from '../Leases/LeaseDialog';
import { getLeases, getLoans, updateLease, deleteLease, updateLoan, deleteLoan } from '../api';

export async function renderLeasesToggle(entityType, entity, refresh, appendTo) {
	const [leasesData, loansData] = await Promise.all([getLeases(), getLoans()]);
	const count =
		Object.values(leasesData?.body || {}).filter(l => l.entityId === entity.id).length +
		Object.values(loansData?.body || {}).filter(l => l.entityId === entity.id).length;

	if (!count) return;

	await renderLeases(entityType, entity, refresh, appendTo);
}

export async function renderLeases(entityType, entity, refresh, appendTo) {
	const [leasesData, loansData] = await Promise.all([getLeases(), getLoans()]);
	const leases = [
		...Object.values(leasesData?.body || {}).filter(l => l.entityId === entity.id),
		...Object.values(loansData?.body || {})
			.filter(l => l.entityId === entity.id)
			.map(l => ({ ...l, _isLoan: true })),
	].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));

	new SectionHeader({ appendTo, textContent: 'Leases & Loans' });

	if (!leases.length) return;

	for (const lease of leases) {
		const isLoan = lease._isLoan === true;
		const isLessor = !isLoan && lease.role === 'lessor';
		const lessorCounterparty = isLessor ? lease.tenantName || 'Tenant' : lease.landlordName || 'Landlord';
		const counterparty = isLoan ? lease.lender || 'Lender' : lessorCounterparty;
		const rate = rateLabel(lease);

		const row = new Component({
			appendTo,
			style: {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-start',
				padding: '6px 0',
				borderBottom: '1px solid rgba(255,255,255,0.06)',
				cursor: 'pointer',
			},
		});

		const left = new Component({ appendTo: row, style: { flex: '1' } });

		const lessorIcon = isLessor ? '📥' : '📤';
		const roleIcon = isLoan ? '🏦' : lessorIcon;
		new Elem({
			tag: 'div',
			appendTo: left,
			style: { fontSize: '13px', color: '#fff' },
			textContent: `${roleIcon} ${counterparty}`,
		});

		const meta = [];

		if (rate) meta.push(rate);
		if (isLoan) {
			if (lease.loanNumber) meta.push(`#${lease.loanNumber}`);
			if (lease.maturityDate) meta.push(`Matures ${new Date(lease.maturityDate).toLocaleDateString()}`);
		} else {
			if (lease.startDate) meta.push(`From ${new Date(lease.startDate).toLocaleDateString()}`);
			if (lease.endDate) meta.push(`→ ${new Date(lease.endDate).toLocaleDateString()}`);
		}
		if (meta.length)
			new Elem({
				tag: 'div',
				appendTo: left,
				style: { fontSize: '11px', color: isLessor ? '#4caf50' : 'rgba(255,255,255,0.4)' },
				textContent: meta.join(' · '),
			});

		row.onPointerPress(
			() =>
				new LeaseDialog({
					lease: lease._isLoan ? { ...lease, role: 'loan' } : lease,
					onSave: async leaseData => {
						const update = lease._isLoan ? updateLoan : updateLease;
						const result = await update(lease.id, { body: { ...leaseData, _v: lease._v } });

						if (result?.status === 'success') refresh();

						return result;
					},
					onDelete: async () => {
						const result = lease._isLoan ? await deleteLoan(lease.id) : await deleteLease(lease.id);

						if (result?.status === 'success') refresh();

						return result;
					},
				}),
		);
	}
}
