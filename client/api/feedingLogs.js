import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getFeedingLogs = async options => await GET('/feeding-logs', { apiId: 'feedingLogs', ...options });
export const createFeedingLog = async options =>
	await POST('/feeding-logs', { invalidates: ['feedingLogs'], ...options });
export const updateFeedingLog = async (id, options) =>
	await versionedUpdate('/feeding-logs/:id', { invalidates: ['feedingLogs'], urlParameters: { id }, ...options });
export const deleteFeedingLog = async (id, options) =>
	await DELETE('/feeding-logs/:id', { invalidates: ['feedingLogs'], urlParameters: { id }, ...options });
