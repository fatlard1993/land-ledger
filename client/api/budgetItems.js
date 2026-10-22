import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const budgetItems = resource('/budget-items', { apiId: 'budgetItems' });

export const getBudgetItems = budgetItems.list;

export const createBudgetItem = budgetItems.create;

export const updateBudgetItem = async (id, options) =>
	await versionedUpdate('/budget-items/:id', { invalidates: ['budgetItems'], urlParameters: { id }, ...options });

export const deleteBudgetItem = budgetItems.delete;
