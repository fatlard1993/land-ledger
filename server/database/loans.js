import { collectionDBs } from './database';
import { createCRUD } from './crud';

const loans = createCRUD(
	'loans',
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
	{},
	collectionDBs.loans,
);

export default loans;
