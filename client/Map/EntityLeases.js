import { formatDate, SectionLabel, theme } from '@vanilla-bean/components';

import LeaseDialog, { rateLabel } from '../Leases/LeaseDialog';
import { getLeases, getLoans, updateLease, deleteLease, updateLoan, deleteLoan } from '../api';
import { IconText } from '../statusIcons';
import { PanelRow, RowMain, RowMeta, RowTitle } from './panelParts';

const { colors } = theme;

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

	new SectionLabel({ appendTo, textContent: 'Leases & Loans' });

	if (!leases.length) return;

	for (const lease of leases) {
		const isLoan = lease._isLoan === true;
		const isLessor = !isLoan && lease.role === 'lessor';
		const lessorCounterparty = isLessor ? lease.tenantName || 'Tenant' : lease.landlordName || 'Landlord';
		const counterparty = isLoan ? lease.lender || 'Lender' : lessorCounterparty;
		const rate = rateLabel(lease);

		const row = new PanelRow({ appendTo, addClass: 'interactive' });
		const left = new RowMain({ appendTo: row });

		// Rent coming in to a lessor, going out from a tenant
		const lessorIcon = isLessor ? 'arrow-right-to-bracket' : 'arrow-right-from-bracket';
		const title = new RowTitle({ appendTo: left });

		new IconText({
			tag: 'span',
			appendTo: title,
			icon: isLoan ? 'building-columns' : lessorIcon,
			textContent: counterparty,
		});

		const meta = [];

		if (rate) meta.push(rate);
		if (isLoan) {
			if (lease.loanNumber) meta.push(`#${lease.loanNumber}`);
			if (lease.maturityDate) meta.push(`Matures ${formatDate(lease.maturityDate)}`);
		} else {
			if (lease.startDate) meta.push(`From ${formatDate(lease.startDate)}`);
			if (lease.endDate) meta.push(`→ ${formatDate(lease.endDate)}`);
		}
		if (meta.length)
			new RowMeta({
				appendTo: left,
				style: isLessor ? { color: colors.light(colors.success) } : {},
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
