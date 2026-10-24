import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const maintenance = crudResource('/maintenance');

export const getMaintenance = maintenance.list;

export const createMaintenance = maintenance.create;

export const updateMaintenance = (id, options) =>
	maintenance.update(id, { onConflict: resolveConflict('/maintenance'), ...options });

export const deleteMaintenance = maintenance.delete;
