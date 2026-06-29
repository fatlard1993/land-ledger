import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getEvents = async options => await GET('/events', { apiId: 'events', ...options });

export const getEvent = async (id, options) =>
	await GET('/events/:id', { apiId: ['events', id], urlParameters: { id }, ...options });

export const createEvent = async options => await POST('/events', { invalidates: ['events'], ...options });

export const updateEvent = async (id, options) =>
	await versionedUpdate('/events/:id', { invalidates: ['events'], urlParameters: { id }, ...options });

export const deleteEvent = async (id, options) =>
	await DELETE('/events/:id', { invalidates: ['events'], urlParameters: { id }, ...options });
