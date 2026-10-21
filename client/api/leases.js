import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const leases = resource('/leases');

export const getLeases = leases.list;

export const getLease = leases.read;

export const createLease = leases.create;

export const updateLease = async (id, options) =>
	await versionedUpdate('/leases/:id', { invalidates: ['leases'], urlParameters: { id }, ...options });

export const deleteLease = leases.delete;
