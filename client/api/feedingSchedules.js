import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const feedingSchedules = resource('/feeding-schedules', { apiId: 'feedingSchedules' });

export const getFeedingSchedules = feedingSchedules.list;

export const createFeedingSchedule = feedingSchedules.create;

export const updateFeedingSchedule = async (id, options) =>
	await versionedUpdate('/feeding-schedules/:id', {
		invalidates: ['feedingSchedules'],
		urlParameters: { id },
		...options,
	});

export const deleteFeedingSchedule = feedingSchedules.delete;
