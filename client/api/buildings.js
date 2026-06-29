import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getBuildings = async options => await GET('/buildings', { apiId: 'buildings', ...options });
export const createBuilding = async options => await POST('/buildings', { invalidates: ['buildings'], ...options });
export const updateBuilding = async (id, options) =>
	await versionedUpdate('/buildings/:id', { invalidates: ['buildings'], urlParameters: { id }, ...options });
export const deleteBuilding = async (id, options) =>
	await DELETE('/buildings/:id', { invalidates: ['buildings'], urlParameters: { id }, ...options });
