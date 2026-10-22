import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const maintenance = resource('/maintenance');

export const getMaintenance = maintenance.list;

export const createMaintenance = maintenance.create;

export const updateMaintenance = async (id, options) =>
	await versionedUpdate('/maintenance/:id', { invalidates: ['maintenance'], urlParameters: { id }, ...options });

export const deleteMaintenance = maintenance.delete;
