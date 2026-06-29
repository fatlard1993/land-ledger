import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getSupplies = async options => await GET('/supplies', { apiId: 'supplies', ...options });
export const createSupply = async options => await POST('/supplies', { invalidates: ['supplies'], ...options });
export const updateSupply = async (id, options) =>
	await versionedUpdate('/supplies/:id', { invalidates: ['supplies'], urlParameters: { id }, ...options });
export const deleteSupply = async (id, options) =>
	await DELETE('/supplies/:id', { invalidates: ['supplies'], urlParameters: { id }, ...options });
