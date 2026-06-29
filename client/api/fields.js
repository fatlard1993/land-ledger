import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getFields = async options => await GET('/fields', { apiId: 'fields', ...options });

export const getField = async (id, options) =>
	await GET('/fields/:id', { apiId: ['fields', id], urlParameters: { id }, ...options });

export const createField = async options => await POST('/fields', { invalidates: ['fields'], ...options });

export const updateField = async (id, options) =>
	await versionedUpdate('/fields/:id', { invalidates: ['fields'], urlParameters: { id }, ...options });

export const deleteField = async (id, options) =>
	await DELETE('/fields/:id', { invalidates: ['fields'], urlParameters: { id }, ...options });
