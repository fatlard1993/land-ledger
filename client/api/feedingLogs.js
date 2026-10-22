import { resource } from '@vanilla-bean/hypertether';

const feedingLogs = resource('/feeding-logs', { apiId: 'feedingLogs' });

export const getFeedingLogs = feedingLogs.list;

export const createFeedingLog = feedingLogs.create;

export const deleteFeedingLog = feedingLogs.delete;
