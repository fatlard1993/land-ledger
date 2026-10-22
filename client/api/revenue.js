import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const revenue = resource('/revenue');

export const getRevenue = revenue.list;

export const createRevenue = revenue.create;

export const updateRevenue = async (id, options) =>
	await versionedUpdate('/revenue/:id', { invalidates: ['revenue'], urlParameters: { id }, ...options });

export const deleteRevenue = revenue.delete;
