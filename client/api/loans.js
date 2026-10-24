import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const loans = crudResource('/loans');

export const getLoans = loans.list;

export const createLoan = loans.create;

export const updateLoan = (id, options) => loans.update(id, { onConflict: resolveConflict('/loans'), ...options });

export const deleteLoan = loans.delete;
