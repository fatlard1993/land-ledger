import { collectionDBs } from './database';
import { collectionStore } from './store';

const loans = collectionStore(
	[
		'entityType',
		'entityId',
		'entityName',
		'lender',
		'loanNumber',
		'loanAmount',
		'interestRate',
		'termYears',
		'monthlyPayment',
		'currentBalance',
		'escrow',
		'assetAppraisalValue',
		'startDate',
		'maturityDate',
		'paymentTerms',
		'paymentDates',
		'notes',
		'properties',
	],
	collectionDBs.loans,
);

export default loans;
