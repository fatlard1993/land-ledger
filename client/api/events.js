import { crudResource } from '@vanilla-bean/components';

import { resolveConflict } from '../ConflictDialog.js';

const events = crudResource('/events');

export const getEvents = events.list;

export const createEvent = events.create;

export const updateEvent = (id, options) => events.update(id, { onConflict: resolveConflict('/events'), ...options });

export const deleteEvent = events.delete;
