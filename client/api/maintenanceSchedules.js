import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getMaintenanceSchedules = async options =>
	await GET('/maintenance-schedules', { apiId: 'maintenanceSchedules', ...options });
export const createMaintenanceSchedule = async options =>
	await POST('/maintenance-schedules', { invalidates: ['maintenanceSchedules'], ...options });
export const updateMaintenanceSchedule = async (id, options) =>
	await versionedUpdate('/maintenance-schedules/:id', {
		invalidates: ['maintenanceSchedules'],
		urlParameters: { id },
		...options,
	});
export const deleteMaintenanceSchedule = async (id, options) =>
	await DELETE('/maintenance-schedules/:id', {
		invalidates: ['maintenanceSchedules'],
		urlParameters: { id },
		...options,
	});
