import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const incidents = crudResource('/incidents');

export const getIncidents = incidents.list;

export const createIncident = incidents.create;

export const updateIncident = (id, options) =>
	incidents.update(id, { onConflict: resolveConflict('/incidents'), ...options });

export const deleteIncident = incidents.delete;
