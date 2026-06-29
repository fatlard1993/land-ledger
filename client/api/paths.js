import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getPaths = async options => await GET('/paths', { apiId: 'paths', ...options });
export const createPath = async options => await POST('/paths', { invalidates: ['paths'], ...options });
export const updatePath = async (id, options) =>
	await versionedUpdate('/paths/:id', { invalidates: ['paths'], urlParameters: { id }, ...options });
export const deletePath = async (id, options) =>
	await DELETE('/paths/:id', { invalidates: ['paths'], urlParameters: { id }, ...options });
