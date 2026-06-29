import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getIncidents = async options => await GET('/incidents', { apiId: 'incidents', ...options });
export const createIncident = async options => await POST('/incidents', { invalidates: ['incidents'], ...options });
export const updateIncident = async (id, options) =>
	await versionedUpdate('/incidents/:id', { invalidates: ['incidents'], urlParameters: { id }, ...options });
export const deleteIncident = async (id, options) =>
	await DELETE('/incidents/:id', { invalidates: ['incidents'], urlParameters: { id }, ...options });
