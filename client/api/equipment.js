import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getEquipment = async options => await GET('/equipment', { apiId: 'equipment', ...options });
export const createEquipment = async options => await POST('/equipment', { invalidates: ['equipment'], ...options });
export const updateEquipment = async (id, options) =>
	await versionedUpdate('/equipment/:id', { invalidates: ['equipment'], urlParameters: { id }, ...options });
export const deleteEquipment = async (id, options) =>
	await DELETE('/equipment/:id', { invalidates: ['equipment'], urlParameters: { id }, ...options });
