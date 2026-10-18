import { collectionDBs } from './database';
import { collectionStore } from './store';

const leases = collectionStore(
	[
		// which side of the agreement
		'role', // 'tenant' (I pay) | 'lessor' (I receive)
		// entity being leased
		'entityType', // 'field' | 'building' | 'equipment'
		'entityId',
		'entityName',
		// counterparty
		'landlordName',
		'tenantName',
		// rate (lease fields)
		'type', // 'cash_per_acre' | 'crop_share' | 'monthly' | 'annual' | 'hourly' | 'per_use'
		'rateAmount',
		'cropSharePercent',
		// loan fields
		'lender',
		'loanAmount',
		'interestRate',
		'termYears',
		'monthlyPayment',
		'currentBalance',
		'loanNumber',
		'escrow',
		'assetAppraisalValue',
		// dates
		'startDate',
		'endDate',
		'maturityDate',
		'renewalDate',
		'paymentTerms',
		'paymentDates',
		'notes',
		'properties',
	],
	collectionDBs.leases,
);

export default leases;
