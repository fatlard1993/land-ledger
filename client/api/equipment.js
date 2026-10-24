import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const equipment = crudResource('/equipment');

export const getEquipment = equipment.list;

export const createEquipment = equipment.create;

export const updateEquipment = (id, options) =>
	equipment.update(id, { onConflict: resolveConflict('/equipment'), ...options });

export const deleteEquipment = equipment.delete;
