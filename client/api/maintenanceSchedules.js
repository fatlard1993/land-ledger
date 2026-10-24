import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const maintenanceSchedules = crudResource('/maintenance-schedules', { apiId: 'maintenanceSchedules' });

export const getMaintenanceSchedules = maintenanceSchedules.list;

export const createMaintenanceSchedule = maintenanceSchedules.create;

export const updateMaintenanceSchedule = (id, options) =>
	maintenanceSchedules.update(id, { onConflict: resolveConflict('/maintenance-schedules'), ...options });

export const deleteMaintenanceSchedule = maintenanceSchedules.delete;
