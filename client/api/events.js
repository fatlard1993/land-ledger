import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const events = resource('/events');

export const getEvents = events.list;

export const getEvent = events.read;

export const createEvent = events.create;

export const updateEvent = async (id, options) =>
	await versionedUpdate('/events/:id', { invalidates: ['events'], urlParameters: { id }, ...options });

export const deleteEvent = events.delete;
