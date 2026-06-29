import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getMaintenance = async options => await GET('/maintenance', { apiId: 'maintenance', ...options });
export const createMaintenance = async options =>
	await POST('/maintenance', { invalidates: ['maintenance'], ...options });
export const updateMaintenance = async (id, options) =>
	await versionedUpdate('/maintenance/:id', { invalidates: ['maintenance'], urlParameters: { id }, ...options });
export const deleteMaintenance = async (id, options) =>
	await DELETE('/maintenance/:id', { invalidates: ['maintenance'], urlParameters: { id }, ...options });
