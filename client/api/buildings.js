import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const buildings = crudResource('/buildings');

export const getBuildings = buildings.list;

export const createBuilding = buildings.create;

export const updateBuilding = (id, options) =>
	buildings.update(id, { onConflict: resolveConflict('/buildings'), ...options });

export const deleteBuilding = buildings.delete;
