import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getBudgetItems = async options => await GET('/budget-items', { apiId: 'budgetItems', ...options });
export const createBudgetItem = async options =>
	await POST('/budget-items', { invalidates: ['budgetItems'], ...options });
export const updateBudgetItem = async (id, options) =>
	await versionedUpdate('/budget-items/:id', { invalidates: ['budgetItems'], urlParameters: { id }, ...options });
export const deleteBudgetItem = async (id, options) =>
	await DELETE('/budget-items/:id', { invalidates: ['budgetItems'], urlParameters: { id }, ...options });
