import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const applicationLogs = crudResource('/application-logs');

export const getApplicationLogs = applicationLogs.list;

export const createApplicationLog = applicationLogs.create;

export const updateApplicationLog = (id, options) =>
	applicationLogs.update(id, { onConflict: resolveConflict('/application-logs'), ...options });

export const deleteApplicationLog = applicationLogs.delete;
