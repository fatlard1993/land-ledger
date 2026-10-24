import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const supplies = crudResource('/supplies');

export const getSupplies = supplies.list;

export const createSupply = supplies.create;

export const updateSupply = (id, options) =>
	supplies.update(id, { onConflict: resolveConflict('/supplies'), ...options });

export const deleteSupply = supplies.delete;
