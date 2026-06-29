import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getRevenue = async options => await GET('/revenue', { apiId: 'revenue', ...options });
export const createRevenue = async options => await POST('/revenue', { invalidates: ['revenue'], ...options });
export const updateRevenue = async (id, options) =>
	await versionedUpdate('/revenue/:id', { invalidates: ['revenue'], urlParameters: { id }, ...options });
export const deleteRevenue = async (id, options) =>
	await DELETE('/revenue/:id', { invalidates: ['revenue'], urlParameters: { id }, ...options });
