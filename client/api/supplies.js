import { resource } from '@vanilla-bean/hypertether';
import { versionedUpdate } from './versionedUpdate.js';

const supplies = resource('/supplies');

export const getSupplies = supplies.list;

export const createSupply = supplies.create;

export const updateSupply = async (id, options) =>
	await versionedUpdate('/supplies/:id', { invalidates: ['supplies'], urlParameters: { id }, ...options });

export const deleteSupply = supplies.delete;
