import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const feedingSchedules = crudResource('/feeding-schedules', { apiId: 'feedingSchedules' });

export const getFeedingSchedules = feedingSchedules.list;

export const createFeedingSchedule = feedingSchedules.create;

export const updateFeedingSchedule = (id, options) =>
	feedingSchedules.update(id, { onConflict: resolveConflict('/feeding-schedules'), ...options });

export const deleteFeedingSchedule = feedingSchedules.delete;
