import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const maintenanceSchedules = resource('/maintenance-schedules', { apiId: 'maintenanceSchedules' });

export const getMaintenanceSchedules = maintenanceSchedules.list;

export const createMaintenanceSchedule = maintenanceSchedules.create;

export const updateMaintenanceSchedule = async (id, options) =>
	await versionedUpdate('/maintenance-schedules/:id', {
		invalidates: ['maintenanceSchedules'],
		urlParameters: { id },
		...options,
	});

export const deleteMaintenanceSchedule = maintenanceSchedules.delete;
