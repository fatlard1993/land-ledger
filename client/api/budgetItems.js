import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const budgetItems = crudResource('/budget-items', { apiId: 'budgetItems' });

export const getBudgetItems = budgetItems.list;

export const createBudgetItem = budgetItems.create;

export const updateBudgetItem = (id, options) =>
	budgetItems.update(id, { onConflict: resolveConflict('/budget-items'), ...options });

export const deleteBudgetItem = budgetItems.delete;
