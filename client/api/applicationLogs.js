import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getApplicationLogs = async options =>
	await GET('/application-logs', { apiId: 'application-logs', ...options });

export const createApplicationLog = async options =>
	await POST('/application-logs', { invalidates: ['application-logs'], ...options });

export const updateApplicationLog = async (id, options) =>
	await versionedUpdate('/application-logs/:id', {
		invalidates: ['application-logs'],
		urlParameters: { id },
		...options,
	});

export const deleteApplicationLog = async (id, options) =>
	await DELETE('/application-logs/:id', { invalidates: ['application-logs'], urlParameters: { id }, ...options });
