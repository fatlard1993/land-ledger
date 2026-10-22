import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const applicationLogs = resource('/application-logs');

export const getApplicationLogs = applicationLogs.list;

export const createApplicationLog = applicationLogs.create;

export const updateApplicationLog = async (id, options) =>
	await versionedUpdate('/application-logs/:id', {
		invalidates: ['application-logs'],
		urlParameters: { id },
		...options,
	});

export const deleteApplicationLog = applicationLogs.delete;
