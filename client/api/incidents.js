import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const incidents = resource('/incidents');

export const getIncidents = incidents.list;

export const createIncident = incidents.create;

export const updateIncident = async (id, options) =>
	await versionedUpdate('/incidents/:id', { invalidates: ['incidents'], urlParameters: { id }, ...options });

export const deleteIncident = incidents.delete;
