import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const revenue = crudResource('/revenue');

export const getRevenue = revenue.list;

export const createRevenue = revenue.create;

export const updateRevenue = (id, options) =>
	revenue.update(id, { onConflict: resolveConflict('/revenue'), ...options });

export const deleteRevenue = revenue.delete;
