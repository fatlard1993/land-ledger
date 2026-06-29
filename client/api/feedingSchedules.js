import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getFeedingSchedules = async options =>
	await GET('/feeding-schedules', { apiId: 'feedingSchedules', ...options });
export const createFeedingSchedule = async options =>
	await POST('/feeding-schedules', { invalidates: ['feedingSchedules'], ...options });
export const updateFeedingSchedule = async (id, options) =>
	await versionedUpdate('/feeding-schedules/:id', {
		invalidates: ['feedingSchedules'],
		urlParameters: { id },
		...options,
	});
export const deleteFeedingSchedule = async (id, options) =>
	await DELETE('/feeding-schedules/:id', { invalidates: ['feedingSchedules'], urlParameters: { id }, ...options });
