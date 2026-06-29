import { GET, POST, DELETE } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

export const getLeases = async options => await GET('/leases', { apiId: 'leases', ...options });

export const getLease = async (id, options) =>
	await GET('/leases/:id', { apiId: ['leases', id], urlParameters: { id }, ...options });

export const createLease = async options => await POST('/leases', { invalidates: ['leases'], ...options });

export const updateLease = async (id, options) =>
	await versionedUpdate('/leases/:id', { invalidates: ['leases'], urlParameters: { id }, ...options });

export const deleteLease = async (id, options) =>
	await DELETE('/leases/:id', { invalidates: ['leases'], urlParameters: { id }, ...options });
